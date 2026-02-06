# Agent Guide (LLMs)

This MCP is optimized for token discipline.

Rules of thumb:

- Prefer summaries. Only pull full page content when you actually need it.
- Never request `mode: "full"` on large artifacts. Use `grep`/`range`/`head`/`tail`.
- Use the manifests: `reader_scrape` and `reader_crawl` store a JSON manifest artifact that contains per-page artifact ids.

## Recommended workflows

### Read a single page

1) Call `reader_scrape` with a single `url`.
2) The response includes a scrape manifest artifact id.
3) Fetch the manifest (small slice first):

```json
{ "id": "art_...", "mode": "head", "headLines": 120 }
```

4) Find the `markdownArtifactId` for the page.
5) Fetch only the needed markdown slice:

```json
{ "id": "art_...", "mode": "range", "startLine": 1, "endLine": 120 }
```

### Crawl a docs site, then scrape only the relevant pages

1) `reader_crawl` with `preview: "summary"`.
2) Use the URL list artifact id from the crawl output.
3) Filter URLs with `reader_artifact_get`:

```json
{ "id": "art_...", "mode": "grep", "pattern": "/(authentication|api|rate-limit)/i" }
```

4) Scrape the handful of matching URLs with `reader_scrape`.

### JS-heavy pages

Use `waitForSelector` on `reader_scrape` to wait for content to render:

```json
{
  "url": "https://example.com/app",
  "waitForSelector": "main article",
  "timeoutMs": 60000
}
```

### Logged-in content (cookies)

Pass headers (keep secrets out of the final answer):

```json
{
  "url": "https://example.com/account",
  "headers": {
    "Cookie": "session=...",
    "Accept-Language": "en-US,en;q=0.9"
  }
}
```

### Cloudflare / bot challenges

1) Call `reader_challenge`.
2) If needed, re-run with `waitForResolution: true`.

## Output size controls

- Most tools accept `preview`:
  - `"summary"` (default): compact JSON summary + artifact ids
  - `"none"`: minimal output, just the artifact ids
  - `"auto"`: return an offload notice (you should use artifacts)

## If Reader is not installed

`@vakra-dev/reader` is an optional dependency. If scrape/crawl fail with a load error:

- Use Node 24.x.
- Run: `npm i @vakra-dev/reader`
