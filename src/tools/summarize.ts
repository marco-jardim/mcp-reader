function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function get(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isObject(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function getString(obj: unknown, path: string[]): string | undefined {
  const v = get(obj, path);
  return typeof v === "string" ? v : undefined;
}

function getNumber(obj: unknown, path: string[]): number | undefined {
  const v = get(obj, path);
  return typeof v === "number" ? v : undefined;
}

function getArray(obj: unknown, path: string[]): unknown[] | undefined {
  const v = get(obj, path);
  return Array.isArray(v) ? v : undefined;
}

export function summarizeScrapeResult(result: unknown): {
  batch?: {
    totalUrls?: number;
    successfulUrls?: number;
    failedUrls?: number;
    totalDuration?: number;
    scrapedAt?: string;
  };
  pages: Array<{
    url?: string;
    title?: string;
    markdownBytes?: number;
    htmlBytes?: number;
    durationMs?: number;
  }>;
  errors: Array<{ url?: string; error?: string }>;
} {
  const batch = {
    totalUrls: getNumber(result, ["batchMetadata", "totalUrls"]),
    successfulUrls: getNumber(result, ["batchMetadata", "successfulUrls"]),
    failedUrls: getNumber(result, ["batchMetadata", "failedUrls"]),
    totalDuration: getNumber(result, ["batchMetadata", "totalDuration"]),
    scrapedAt: getString(result, ["batchMetadata", "scrapedAt"])
  };

  const data = getArray(result, ["data"]) ?? [];
  const pages = data.slice(0, 50).map((item) => {
    const url = getString(item, ["metadata", "baseUrl"]);
    const title = getString(item, ["metadata", "website", "title"]);
    const markdown = getString(item, ["markdown"]);
    const html = getString(item, ["html"]);
    return {
      url,
      title,
      markdownBytes: markdown ? Buffer.byteLength(markdown, "utf8") : undefined,
      htmlBytes: html ? Buffer.byteLength(html, "utf8") : undefined,
      durationMs: getNumber(item, ["metadata", "duration"])
    };
  });

  const errors = (getArray(result, ["batchMetadata", "errors"]) ?? [])
    .slice(0, 50)
    .map((e) => ({
      url: getString(e, ["url"]),
      error: getString(e, ["error"])
    }));

  return { batch, pages, errors };
}

export function summarizeCrawlResult(result: unknown): {
  meta?: {
    seedUrl?: string;
    totalUrls?: number;
    maxDepth?: number;
    totalDuration?: number;
  };
  urls: Array<{ url?: string; title?: string; description?: string | null }>;
  hasScraped: boolean;
} {
  const meta = {
    seedUrl: getString(result, ["metadata", "seedUrl"]),
    totalUrls: getNumber(result, ["metadata", "totalUrls"]),
    maxDepth: getNumber(result, ["metadata", "maxDepth"]),
    totalDuration: getNumber(result, ["metadata", "totalDuration"])
  };

  const urls = (getArray(result, ["urls"]) ?? []).slice(0, 50).map((u) => ({
    url: getString(u, ["url"]),
    title: getString(u, ["title"]),
    description: ((): string | null | undefined => {
      const v = get(u, ["description"]);
      return v === null || typeof v === "string" ? v : undefined;
    })()
  }));

  const hasScraped = get(result, ["scraped"]) !== undefined;

  return { meta, urls, hasScraped };
}
