# mcp-reader

MCP server for [`@vakra-dev/reader`](https://github.com/vakra-dev/reader): scrape and crawl websites using a real browser, and keep LLM context small with artifact offloading.

This server is built for Claude Code / OpenCode:

- Tool outputs are intentionally compact (summaries + artifact ids).
- Full payloads (manifests, markdown, html, url lists) are stored as artifacts.
- Agents fetch only what they need via `reader_artifact_get` (`grep`, `range`, `head`, `tail`).

## Requirements

- Node: `>=24`
- `@vakra-dev/reader` is an optional dependency. If it fails to install (native deps), `mcp-reader` will still install, but scrape/crawl tools will fail until Reader is installed.

Recommended:

- Use Node 24.x for the smoothest native-dependency story.

## Install

```bash
npm install mcp-reader
```

If Reader did not install automatically (you will see warnings during `npm install`), install it explicitly:

```bash
npm install @vakra-dev/reader
```

## Configure (Claude Code / OpenCode)

Recommended (Windows-safe): run through `node` to avoid `.cmd` wrapper spawning issues.

```json
{
  "mcpServers": {
    "reader": {
      "command": "node",
      "args": ["./node_modules/mcp-reader/dist/cli.js"],
      "env": {
        "MCP_READER_LOG_LEVEL": "info",
        "MCP_READER_STORE": "file:.mcp-reader-artifacts",
        "MCP_READER_MAX_BYTES": "80000",
        "MCP_READER_PREVIEW_MAX_CHARS": "6000"
      }
    }
  }
}
```

## Tools

- `reader_scrape`: Scrape 1+ URLs. Returns a summary and stores a scrape manifest + per-page markdown/html as artifacts.
- `reader_crawl`: Crawl a site (depth/maxPages/pattern filters) and optionally scrape discovered pages. Stores crawl manifest + URL list (+ scrape manifest if enabled).
- `reader_challenge`: Detect Cloudflare/anti-bot challenge and optionally wait for resolution.
- `reader_status`: Show server config + whether ReaderClient is initialized.
- `reader_warmup`: Warm up ReaderClient/browser core.
- `reader_close`: Close ReaderClient/browser pools.

Artifacts (token saving):

- `reader_artifact_get`: Fetch slices of stored artifacts (`auto|head|tail|range|grep|full|json`).
- `reader_artifact_info`: Artifact metadata.
- `reader_artifact_list`: List recent artifacts.
- `reader_artifact_delete`: Delete an artifact.

## How To Use (Humans)

Read a single page (main content -> markdown):

```json
{
  "url": "https://docs.reader.dev/documentation/overview",
  "formats": ["markdown"],
  "onlyMainContent": true
}
```

You will receive:

- a compact scrape summary
- a manifest artifact id with per-page `markdownArtifactId` / `htmlArtifactId`

Then fetch the markdown artifact:

```json
{ "id": "art_...", "mode": "head", "headLines": 80 }
```

## How To Use (Agents)

Start with the smallest signal:

1) `reader_crawl` with `preview: "summary"` to get a URL inventory.
2) Use `reader_artifact_get` with `grep` / `range` on the URL list artifact.
3) `reader_scrape` only the handful of relevant URLs.
4) Fetch only the needed slices of markdown via `reader_artifact_get`.

More: `AGENTS.md`

## Artifact Storage + Truncation

Artifact store:

- `MCP_READER_STORE`: `memory` (default) or `file:.mcp-reader-artifacts`

Truncation knobs:

- `MCP_READER_MAX_BYTES`: Offload threshold (default `80000`)
- `MCP_READER_PREVIEW_MAX_CHARS`: Preview cap (default `6000`)
- `MCP_READER_HEAD_LINES` / `MCP_READER_TAIL_LINES`: Preview slices (default `60` / `60`)
- `MCP_READER_TTL_SECONDS`: Optional TTL for memory store
- `MCP_READER_MAX_ARTIFACTS`: Optional cap for memory store

## ReaderClient Configuration

Configure Reader via env (JSON):

- `MCP_READER_BROWSER_POOL`: `{ "size": 2, "retireAfterPages": 100, "retireAfterMinutes": 30, "maxQueueSize": 100 }`
- `MCP_READER_PROXIES`: `[ { "url": "http://user:pass@host:port", "country": "US" } ]`
- `MCP_READER_PROXY_ROTATION`: `round-robin` or `random`
- `MCP_READER_VERBOSE`: `true|false`
- `MCP_READER_SHOW_CHROME`: `true|false`

## Documentation

- `docs/TOOLS.md`: tool-by-tool reference with examples
- `docs/CONFIG.md`: configuration and environment variables
- `docs/TRUNCATION.md`: artifact modes and token-saving patterns
- `docs/RELEASE.md`: CI/CD + release + npm publish

## CI / Releases / npm publish

- CI: lint + typecheck + tests + build
- Releases: Release Please opens a PR with version bump + changelog
- Publish: on release creation, GitHub Actions publishes to npm

Required GitHub secrets:

- `NPM_TOKEN`: npm automation token with publish rights

## Development

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## License

GPL-3.0-only. See `LICENSE`.
