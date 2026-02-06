import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
import { createArtifactStore } from "./artifacts/factory.js";
import type { ArtifactStore, ArtifactMeta } from "./artifacts/types.js";
import { sliceText } from "./artifacts/slice.js";
import { ReaderRuntime } from "./reader/runtime.js";
import {
  ArtifactDeleteSchema,
  ArtifactGetSchema,
  ArtifactInfoSchema,
  ArtifactListSchema,
  ChallengeInputSchema,
  CrawlInputSchema,
  ScrapeInputSchema
} from "./tools/schemas.js";
import {
  ArtifactDeleteJsonSchema,
  ArtifactGetJsonSchema,
  ArtifactInfoJsonSchema,
  ArtifactListJsonSchema,
  ChallengeInputJsonSchema,
  CrawlInputJsonSchema,
  ScrapeInputJsonSchema
} from "./tools/json-schema.js";
import { summarizeCrawlResult, summarizeScrapeResult } from "./tools/summarize.js";

function okText(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function getStringDeep(value: unknown, path: string[]): string | undefined {
  let cur: unknown = value;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return typeof cur === "string" ? cur : undefined;
}

function getDeep(value: unknown, path: string[]): unknown {
  let cur: unknown = value;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function getServerVersion(): string {
  return process.env.npm_package_version ?? "0.1.0";
}

function bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function formatArtifactLine(meta: ArtifactMeta): string {
  const attrs = meta.attributes
    ? Object.entries(meta.attributes)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
    : "";
  return `- ${meta.id} (${meta.contentType}, ${meta.bytes} bytes, ${meta.lineCount} lines) ${attrs}`.trim();
}

function toJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function storeToolResult(
  store: ArtifactStore,
  tool: string,
  contentType: "application/json" | "text/plain" | "text/markdown" | "text/html",
  text: string,
  attributes?: Record<string, string>
): Promise<ArtifactMeta> {
  return await store.put({ tool, contentType, text, attributes });
}

function buildOffloadNotice(meta: ArtifactMeta): string {
  return [
    "RESULT OFFLOADED TO ARTIFACT",
    formatArtifactLine(meta),
    "",
    "Use reader_artifact_get to fetch slices:",
    `- auto: { id: "${meta.id}", mode: "auto" }`,
    `- head: { id: "${meta.id}", mode: "head", headLines: 80 }`,
    `- tail: { id: "${meta.id}", mode: "tail", tailLines: 80 }`,
    `- grep: { id: "${meta.id}", mode: "grep", pattern: "/error|failed/i" }`,
    `- range: { id: "${meta.id}", mode: "range", startLine: 200, endLine: 260 }`
  ].join("\n");
}

type StoredScrapeManifest = {
  manifestMeta: ArtifactMeta;
  pagesStored: number;
  markdownArtifacts: number;
  htmlArtifacts: number;
};

async function storeScrapeArtifactsFromResult(args: {
  store: ArtifactStore;
  toolPrefix: string;
  result: unknown;
  attributes?: Record<string, string>;
  maxPages: number;
}): Promise<StoredScrapeManifest> {
  const { store, toolPrefix, result, attributes, maxPages } = args;

  const dataUnknown = getDeep(result, ["data"]);
  const data = Array.isArray(dataUnknown) ? dataUnknown : [];

  const pages: Array<Record<string, unknown>> = [];
  let markdownArtifacts = 0;
  let htmlArtifacts = 0;

  for (let i = 0; i < Math.min(data.length, maxPages); i++) {
    const item = data[i];
    const pageUrl = getStringDeep(item, ["metadata", "baseUrl"]) ?? `page_${i}`;

    const pageEntry: Record<string, unknown> = {
      url: pageUrl,
      title: getStringDeep(item, ["metadata", "website", "title"]) ?? undefined,
      metadata: getDeep(item, ["metadata"]) ?? undefined
    };

    const markdown = isRecord(item) && typeof item.markdown === "string" ? item.markdown : undefined;
    const html = isRecord(item) && typeof item.html === "string" ? item.html : undefined;

    if (markdown) {
      const m = await storeToolResult(
        store,
        `${toolPrefix}.markdown`,
        "text/markdown",
        markdown,
        { ...(attributes ?? {}), url: pageUrl }
      );
      pageEntry.markdownArtifactId = m.id;
      pageEntry.markdownBytes = bytes(markdown);
      markdownArtifacts += 1;
    }

    if (html) {
      const h = await storeToolResult(
        store,
        `${toolPrefix}.html`,
        "text/html",
        html,
        { ...(attributes ?? {}), url: pageUrl }
      );
      pageEntry.htmlArtifactId = h.id;
      pageEntry.htmlBytes = bytes(html);
      htmlArtifacts += 1;
    }

    pages.push(pageEntry);
  }

  const manifest: Record<string, unknown> = {
    kind: "scrape-manifest",
    tool: toolPrefix,
    generatedAt: new Date().toISOString(),
    batchMetadata: getDeep(result, ["batchMetadata"]) ?? undefined,
    pages
  };

  const manifestMeta = await storeToolResult(
    store,
    `${toolPrefix}.manifest`,
    "application/json",
    toJsonText(manifest),
    attributes
  );

  return {
    manifestMeta,
    pagesStored: pages.length,
    markdownArtifacts,
    htmlArtifacts
  };
}

export function createMcpServer(args: { config: AppConfig; logger: Logger }): Server {
  const { config, logger } = args;
  const store = createArtifactStore(config.artifacts);
  const reader = new ReaderRuntime(config.readerClient, logger);

  const server = new Server(
    { name: "mcp-reader", version: getServerVersion() },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "reader_scrape",
          description:
            "Scrape one or more URLs with @vakra-dev/reader. Returns a compact summary and stores a manifest + per-page markdown/html as artifacts.",
          inputSchema: ScrapeInputJsonSchema
        },
        {
          name: "reader_crawl",
          description:
            "Crawl a website (depth/maxPages/patterns) and optionally scrape discovered pages. Returns a compact summary and stores a crawl manifest + URL list (and scrape manifest if enabled) as artifacts.",
          inputSchema: CrawlInputJsonSchema
        },
        {
          name: "reader_challenge",
          description:
            "Detect Cloudflare/anti-bot challenges using Reader's BrowserPool utilities; optionally wait for resolution.",
          inputSchema: ChallengeInputJsonSchema
        },
        {
          name: "reader_status",
          description: "Show MCP Reader server status and configuration.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false }
        },
        {
          name: "reader_warmup",
          description:
            "Warm up the internal ReaderClient (start browser core) to reduce first-call latency.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false }
        },
        {
          name: "reader_close",
          description: "Close the internal ReaderClient and any browser pools.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false }
        },
        {
          name: "reader_artifact_get",
          description:
            "Fetch a slice of an offloaded artifact (auto/head/tail/range/grep/full/json).",
          inputSchema: ArtifactGetJsonSchema
        },
        {
          name: "reader_artifact_info",
          description: "Get metadata about a stored artifact.",
          inputSchema: ArtifactInfoJsonSchema
        },
        {
          name: "reader_artifact_list",
          description: "List stored artifacts (most recent first).",
          inputSchema: ArtifactListJsonSchema
        },
        {
          name: "reader_artifact_delete",
          description: "Delete a stored artifact by id.",
          inputSchema: ArtifactDeleteJsonSchema
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const input = request.params.arguments ?? {};

    try {
      if (name === "reader_status") {
        const ready = await reader.isReady();
        return okText(
          toJsonText({
            ready,
            artifacts: {
              store: config.artifacts.store,
              maxBytes: config.artifacts.maxBytes,
              previewMaxChars: config.artifacts.previewMaxChars
            },
            readerClient: {
              verbose: config.readerClient.verbose,
              showChrome: config.readerClient.showChrome,
              proxyRotation: config.readerClient.proxyRotation,
              browserPool: config.readerClient.browserPool,
              proxiesConfigured: (config.readerClient.proxies ?? []).length
            }
          })
        );
      }

      if (name === "reader_warmup") {
        await reader.warmup();
        return okText("Reader warmup complete.");
      }

      if (name === "reader_close") {
        await reader.close();
        return okText("Reader client closed.");
      }

      if (name === "reader_artifact_get") {
        const args = ArtifactGetSchema.parse(input);
        const { meta, text } = await store.getText(args.id);
        const sliced = sliceText(text, {
          mode: args.mode,
          pattern: args.pattern,
          startLine: args.startLine,
          endLine: args.endLine,
          headLines: args.headLines ?? config.artifacts.headLines,
          tailLines: args.tailLines ?? config.artifacts.tailLines,
          maxLines: args.maxLines,
          maxBytes: args.maxBytes,
          previewMaxChars: config.artifacts.previewMaxChars
        });

        const header = `${meta.id} (${meta.contentType}, ${meta.bytes} bytes, ${meta.lineCount} lines)`;
        return okText(`${header}\n\n${sliced}`);
      }

      if (name === "reader_artifact_info") {
        const args = ArtifactInfoSchema.parse(input);
        const meta = await store.info(args.id);
        return okText(toJsonText(meta));
      }

      if (name === "reader_artifact_list") {
        const args = ArtifactListSchema.parse(input);
        const metas = await store.list(args.limit);
        const lines = metas.map(formatArtifactLine);
        return okText(lines.length ? lines.join("\n") : "[no artifacts]");
      }

      if (name === "reader_artifact_delete") {
        const args = ArtifactDeleteSchema.parse(input);
        await store.delete(args.id);
        return okText(`Deleted artifact: ${args.id}`);
      }

      if (name === "reader_challenge") {
        const args = ChallengeInputSchema.parse(input);
        const res = await reader.detectChallenge(args);
        const meta = await storeToolResult(
          store,
          "reader_challenge",
          "application/json",
          toJsonText(res),
          { url: args.url }
        );

        const text = toJsonText(res);
        if (bytes(text) > config.artifacts.maxBytes) {
          return okText(buildOffloadNotice(meta));
        }
        return okText(text);
      }

      if (name === "reader_scrape") {
        const args = ScrapeInputSchema.parse(input);
        const urls = Array.from(
          new Set([args.url, ...(args.urls ?? [])].filter(Boolean))
        );

        const scrapeOptions: Record<string, unknown> = {
          urls,
          formats: args.formats,
          onlyMainContent: args.onlyMainContent,
          includeTags: args.includeTags,
          excludeTags: args.excludeTags,
          userAgent: args.userAgent,
          headers: args.headers,
          timeoutMs: args.timeoutMs,
          includePatterns: args.includePatterns,
          excludePatterns: args.excludePatterns,
          batchConcurrency: args.batchConcurrency,
          batchTimeoutMs: args.batchTimeoutMs,
          maxRetries: args.maxRetries,
          proxy: args.proxy,
          waitForSelector: args.waitForSelector,
          verbose: args.verbose,
          showChrome: args.showChrome
        };

        const result = await reader.scrape(scrapeOptions);

        const summary = summarizeScrapeResult(result);
        const stored = await storeScrapeArtifactsFromResult({
          store,
          toolPrefix: "reader_scrape",
          result,
          attributes: { urls: String(urls.length) },
          maxPages: 200
        });

        const summaryText = [
          "SCRAPE SUMMARY",
          toJsonText(summary),
          "",
          "Artifacts:",
          formatArtifactLine(stored.manifestMeta),
          `- stored: pages=${stored.pagesStored} markdown=${stored.markdownArtifacts} html=${stored.htmlArtifacts}`
        ].join("\n");

        if (args.preview === "none") {
          return okText(
            [
              "SCRAPE COMPLETE",
              formatArtifactLine(stored.manifestMeta)
            ]
              .filter((l) => l.length > 0)
              .join("\n")
          );
        }

        if (bytes(summaryText) > config.artifacts.maxBytes || args.preview === "auto") {
          return okText(buildOffloadNotice(stored.manifestMeta));
        }

        return okText(summaryText);
      }

      if (name === "reader_crawl") {
        const args = CrawlInputSchema.parse(input);
        const crawlOptions: Record<string, unknown> = {
          url: args.url,
          depth: args.depth,
          maxPages: args.maxPages,
          scrape: args.scrape,
          delayMs: args.delayMs,
          timeoutMs: args.timeoutMs,
          includePatterns: args.includePatterns,
          excludePatterns: args.excludePatterns,
          formats: args.formats,
          scrapeConcurrency: args.scrapeConcurrency,
          proxy: args.proxy,
          userAgent: args.userAgent,
          verbose: args.verbose,
          showChrome: args.showChrome
        };

        const result = await reader.crawl(crawlOptions);

        const crawlSummary = summarizeCrawlResult(result);

        const urlsUnknown = getDeep(result, ["urls"]);
        const urlsArr = Array.isArray(urlsUnknown) ? urlsUnknown : [];
        const urlLines = urlsArr
          .map((u) => getStringDeep(u, ["url"]) ?? "")
          .filter((u) => u.length > 0);

        const urlListMeta = await storeToolResult(
          store,
          "reader_crawl.urls",
          "text/plain",
          urlLines.join("\n"),
          { url: args.url }
        );

        const scrapedUnknown = getDeep(result, ["scraped"]);
        const scrapedManifest =
          scrapedUnknown !== undefined
            ? await storeScrapeArtifactsFromResult({
                store,
                toolPrefix: "reader_crawl.scraped",
                result: scrapedUnknown,
                attributes: { url: args.url },
                maxPages: 200
              })
            : undefined;

        const crawlManifest: Record<string, unknown> = {
          kind: "crawl-manifest",
          tool: "reader_crawl",
          generatedAt: new Date().toISOString(),
          metadata: getDeep(result, ["metadata"]) ?? undefined,
          urls: urlsUnknown ?? undefined,
          urlListArtifactId: urlListMeta.id,
          scrapedManifestArtifactId: scrapedManifest?.manifestMeta.id
        };

        const crawlManifestMeta = await storeToolResult(
          store,
          "reader_crawl.manifest",
          "application/json",
          toJsonText(crawlManifest),
          { url: args.url }
        );

        const summaryText = [
          "CRAWL SUMMARY",
          toJsonText(crawlSummary),
          "",
          "Artifacts:",
          formatArtifactLine(crawlManifestMeta),
          formatArtifactLine(urlListMeta),
          scrapedManifest ? formatArtifactLine(scrapedManifest.manifestMeta) : ""
        ]
          .filter((l) => l.length > 0)
          .join("\n");

        if (args.preview === "none") {
          return okText(
            [
              "CRAWL COMPLETE",
              formatArtifactLine(crawlManifestMeta),
              formatArtifactLine(urlListMeta),
              scrapedManifest ? formatArtifactLine(scrapedManifest.manifestMeta) : ""
            ].join("\n")
          );
        }

        if (bytes(summaryText) > config.artifacts.maxBytes || args.preview === "auto") {
          return okText(buildOffloadNotice(crawlManifestMeta));
        }

        return okText(summaryText);
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (err) {
      logger.error(`Tool failed: ${name}`, err);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${name} failed: ${message}`);
    }
  });

  const originalClose = server.close.bind(server);
  server.close = async () => {
    await reader.close();
    await originalClose();
  };

  return server;
}
