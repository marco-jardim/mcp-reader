# Tool Reference

All tools return small responses and store full payloads as artifacts.

## reader_scrape

Scrape one or more URLs.

Input (high level):

- `url` or `urls`: target(s)
- `formats`: `["markdown"]` (default) or include `"html"`
- `onlyMainContent`: `true` (default)
- `includeTags` / `excludeTags`: CSS selectors
- `headers`: string map; useful for `Cookie`, `Accept-Language`
- `waitForSelector`: CSS selector to wait for
- `timeoutMs`: per-page timeout
- `batchConcurrency`, `batchTimeoutMs`, `maxRetries`
- `includePatterns` / `excludePatterns`: URL regex strings
- `proxy`: proxy object
- `preview`: `summary|none|auto`

Output:

- Summary JSON (first ~50 pages) including byte sizes
- Scrape manifest artifact id containing:
  - `pages[].markdownArtifactId`
  - `pages[].htmlArtifactId`
  - per-page metadata

## reader_crawl

Crawl starting from a seed URL.

Input:

- `url`: seed
- `depth`, `maxPages`, `delayMs`
- `includePatterns` / `excludePatterns`
- `scrape`: if true, also scrapes discovered pages
- `formats`: formats to use when `scrape: true`
- `scrapeConcurrency`
- `proxy`, `userAgent`
- `preview`: `summary|none|auto`

Output:

- Crawl summary JSON (first ~50 URLs)
- URL list artifact (`text/plain`) for easy grep/range
- Crawl manifest artifact (`application/json`) containing:
  - full `urls` objects
  - `urlListArtifactId`
  - `scrapedManifestArtifactId` (if `scrape: true`)

## reader_challenge

Detect anti-bot challenges.

Input:

- `url`
- `waitForResolution` (default false)
- `maxWaitMs`, `pollIntervalMs`, `verbose`

Output:

- JSON (or an offload notice if large) and an artifact id.

## reader_status / reader_warmup / reader_close

Lifecycle helpers.

## Artifact tools

### reader_artifact_get

Fetch slices of a stored artifact.

- `mode: "auto"`: error excerpts + head/tail
- `mode: "head"|"tail"`: line slices
- `mode: "range"`: numbered line range
- `mode: "grep"`: substring (case-insensitive) or regex `/.../i`
- `mode: "full"|"json"`: raw text (byte-capped)

Examples:

```json
{ "id": "art_...", "mode": "grep", "pattern": "/rate limit|429/i" }
```

```json
{ "id": "art_...", "mode": "range", "startLine": 200, "endLine": 260 }
```

### reader_artifact_list / reader_artifact_info / reader_artifact_delete

Manage stored artifacts.
