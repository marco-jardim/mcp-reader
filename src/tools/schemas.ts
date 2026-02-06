import { z } from "zod";

export const ProxyConfigSchema = z
  .object({
    url: z.string().url().optional(),
    type: z.enum(["datacenter", "residential"]).optional(),
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    country: z.string().optional()
  })
  .strict();

export const ScrapeInputSchema = z
  .object({
    url: z.string().url().optional(),
    urls: z.array(z.string().url()).optional(),
    formats: z.array(z.enum(["markdown", "html"])).default(["markdown"]),
    onlyMainContent: z.boolean().default(true),
    includeTags: z.array(z.string()).default([]),
    excludeTags: z.array(z.string()).default([]),
    userAgent: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    timeoutMs: z.number().int().positive().optional(),
    includePatterns: z.array(z.string()).default([]),
    excludePatterns: z.array(z.string()).default([]),
    batchConcurrency: z.number().int().positive().optional(),
    batchTimeoutMs: z.number().int().positive().optional(),
    maxRetries: z.number().int().nonnegative().optional(),
    proxy: ProxyConfigSchema.optional(),
    waitForSelector: z.string().optional(),
    verbose: z.boolean().optional(),
    showChrome: z.boolean().optional(),
    preview: z.enum(["none", "summary", "auto"]).default("summary")
  })
  .superRefine((val, ctx) => {
    const urls = [val.url, ...(val.urls ?? [])].filter(
      (u): u is string => typeof u === "string" && u.length > 0
    );
    if (urls.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide url or urls"
      });
    }
  });

export const CrawlInputSchema = z.object({
  url: z.string().url(),
  depth: z.number().int().positive().default(1),
  maxPages: z.number().int().positive().default(20),
  scrape: z.boolean().default(false),
  delayMs: z.number().int().nonnegative().default(1000),
  timeoutMs: z.number().int().positive().optional(),
  includePatterns: z.array(z.string()).default([]),
  excludePatterns: z.array(z.string()).default([]),
  formats: z
    .array(z.enum(["markdown", "html", "json", "text"]))
    .default(["markdown", "html"]),
  scrapeConcurrency: z.number().int().positive().default(2),
  proxy: ProxyConfigSchema.optional(),
  userAgent: z.string().optional(),
  verbose: z.boolean().optional(),
  showChrome: z.boolean().optional(),
  preview: z.enum(["none", "summary", "auto"]).default("summary")
});

export const ChallengeInputSchema = z.object({
  url: z.string().url(),
  waitForResolution: z.boolean().default(false),
  maxWaitMs: z.number().int().positive().optional(),
  pollIntervalMs: z.number().int().positive().optional(),
  verbose: z.boolean().optional()
});

export const ArtifactGetSchema = z.object({
  id: z.string(),
  mode: z
    .enum(["auto", "head", "tail", "range", "grep", "full", "json"])
    .default("auto"),
  pattern: z.string().optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  headLines: z.number().int().positive().optional(),
  tailLines: z.number().int().positive().optional(),
  maxLines: z.number().int().positive().optional(),
  maxBytes: z.number().int().positive().optional()
});

export const ArtifactListSchema = z.object({
  limit: z.number().int().positive().max(100).default(20)
});

export const ArtifactInfoSchema = z.object({
  id: z.string()
});

export const ArtifactDeleteSchema = z.object({
  id: z.string()
});
