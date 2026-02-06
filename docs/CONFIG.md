# Configuration

`mcp-reader` is configured via environment variables.

## Logging

- `MCP_READER_LOG_LEVEL`: `silent|error|warn|info|debug` (default `info`)

## Artifact store

- `MCP_READER_STORE`: `memory` (default) or `file:.mcp-reader-artifacts`
- `MCP_READER_MAX_BYTES`: offload threshold (default `80000`)
- `MCP_READER_PREVIEW_MAX_CHARS`: preview cap (default `6000`)
- `MCP_READER_HEAD_LINES`: preview head lines (default `60`)
- `MCP_READER_TAIL_LINES`: preview tail lines (default `60`)
- `MCP_READER_TTL_SECONDS`: TTL (memory store)
- `MCP_READER_MAX_ARTIFACTS`: cap (memory store)

## ReaderClient config

You can pass ReaderClient options using JSON env vars:

- `MCP_READER_BROWSER_POOL`
- `MCP_READER_PROXIES`
- `MCP_READER_PROXY_ROTATION`

Or individual flags:

- `MCP_READER_VERBOSE`: `true|false`
- `MCP_READER_SHOW_CHROME`: `true|false`

Examples:

```json
{
  "size": 2,
  "retireAfterPages": 100,
  "retireAfterMinutes": 30,
  "maxQueueSize": 100
}
```

Proxy example:

```json
[
  {
    "url": "http://user:pass@host:port",
    "country": "US",
    "type": "residential"
  }
]
```
