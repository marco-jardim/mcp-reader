# Token-Saving Truncation

This server offloads large tool results to artifacts and returns only a compact preview + artifact ids.

## Why

Website content is large. Returning full markdown/html to an agent wastes context.

## Artifact modes

- `auto`: best default; includes error excerpts + head/tail
- `head` / `tail`: quick scanning
- `grep`: find keywords without pulling the full payload
- `range`: pull only the block you need
- `full` / `json`: last resort (byte-capped)

## Practical patterns

- Use `grep` on the URL list from `reader_crawl` to identify candidate pages.
- Use `range` on markdown artifacts to pull specific sections.
- Use `auto` first when debugging failures.

## Storage backends

- `memory`: fastest; resets on process restart
- `file:.mcp-reader-artifacts`: persistent on disk; recommended for long sessions
