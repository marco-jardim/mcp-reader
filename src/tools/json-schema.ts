export type JsonSchema = Record<string, unknown>;

export const EmptyObjectSchema: JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false
};

export const ProxyConfigJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    url: { type: "string", description: "Full proxy URL (takes precedence)." },
    type: { type: "string", enum: ["datacenter", "residential"] },
    host: { type: "string" },
    port: { type: "integer", minimum: 1 },
    username: { type: "string" },
    password: { type: "string" },
    country: { type: "string" }
  }
};

export const ScrapeInputJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    url: { type: "string", format: "uri" },
    urls: { type: "array", items: { type: "string", format: "uri" } },
    formats: {
      type: "array",
      items: { type: "string", enum: ["markdown", "html"] },
      default: ["markdown"]
    },
    onlyMainContent: { type: "boolean", default: true },
    includeTags: { type: "array", items: { type: "string" }, default: [] },
    excludeTags: { type: "array", items: { type: "string" }, default: [] },
    userAgent: { type: "string" },
    headers: { type: "object", additionalProperties: { type: "string" } },
    timeoutMs: { type: "integer", minimum: 1 },
    includePatterns: { type: "array", items: { type: "string" }, default: [] },
    excludePatterns: { type: "array", items: { type: "string" }, default: [] },
    batchConcurrency: { type: "integer", minimum: 1 },
    batchTimeoutMs: { type: "integer", minimum: 1 },
    maxRetries: { type: "integer", minimum: 0 },
    proxy: ProxyConfigJsonSchema,
    waitForSelector: { type: "string" },
    verbose: { type: "boolean" },
    showChrome: { type: "boolean" },
    preview: {
      type: "string",
      enum: ["none", "summary", "auto"],
      default: "summary"
    }
  },
  anyOf: [{ required: ["url"] }, { required: ["urls"] }]
};

export const CrawlInputJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: { type: "string", format: "uri" },
    depth: { type: "integer", minimum: 1, default: 1 },
    maxPages: { type: "integer", minimum: 1, default: 20 },
    scrape: { type: "boolean", default: false },
    delayMs: { type: "integer", minimum: 0, default: 1000 },
    timeoutMs: { type: "integer", minimum: 1 },
    includePatterns: { type: "array", items: { type: "string" }, default: [] },
    excludePatterns: { type: "array", items: { type: "string" }, default: [] },
    formats: {
      type: "array",
      items: { type: "string", enum: ["markdown", "html", "json", "text"] },
      default: ["markdown", "html"]
    },
    scrapeConcurrency: { type: "integer", minimum: 1, default: 2 },
    proxy: ProxyConfigJsonSchema,
    userAgent: { type: "string" },
    verbose: { type: "boolean" },
    showChrome: { type: "boolean" },
    preview: {
      type: "string",
      enum: ["none", "summary", "auto"],
      default: "summary"
    }
  }
};

export const ChallengeInputJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: { type: "string", format: "uri" },
    waitForResolution: { type: "boolean", default: false },
    maxWaitMs: { type: "integer", minimum: 1 },
    pollIntervalMs: { type: "integer", minimum: 1 },
    verbose: { type: "boolean" }
  }
};

export const ArtifactGetJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: { type: "string" },
    mode: {
      type: "string",
      enum: ["auto", "head", "tail", "range", "grep", "full", "json"],
      default: "auto"
    },
    pattern: { type: "string" },
    startLine: { type: "integer", minimum: 1 },
    endLine: { type: "integer", minimum: 1 },
    headLines: { type: "integer", minimum: 1 },
    tailLines: { type: "integer", minimum: 1 },
    maxLines: { type: "integer", minimum: 1 },
    maxBytes: { type: "integer", minimum: 1 }
  }
};

export const ArtifactInfoJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: { type: "string" } }
};

export const ArtifactListJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 20 } }
};

export const ArtifactDeleteJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: { type: "string" } }
};
