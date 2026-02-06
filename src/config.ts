import path from "node:path";

import type { LogLevel } from "./logger.js";

export interface BrowserPoolConfig {
  size?: number;
  retireAfterPages?: number;
  retireAfterMinutes?: number;
  maxQueueSize?: number;
}

export type ProxyRotation = "round-robin" | "random";

export interface ProxyConfig {
  url?: string;
  type?: "datacenter" | "residential";
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  country?: string;
}

export interface ReaderClientConfig {
  verbose?: boolean;
  showChrome?: boolean;
  browserPool?: BrowserPoolConfig;
  proxies?: ProxyConfig[];
  proxyRotation?: ProxyRotation;
}

export interface ArtifactConfig {
  store: { type: "memory" } | { type: "file"; dir: string };
  maxBytes: number;
  previewMaxChars: number;
  headLines: number;
  tailLines: number;
  ttlSeconds?: number;
  maxArtifacts?: number;
}

export interface AppConfig {
  logLevel: LogLevel;
  artifacts: ArtifactConfig;
  readerClient: ReaderClientConfig;
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (/^(1|true|yes|y|on)$/i.test(value)) return true;
  if (/^(0|false|no|n|off)$/i.test(value)) return false;
  return undefined;
}

function parseIntSafe(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const logLevel =
    (env.MCP_READER_LOG_LEVEL as LogLevel | undefined) ?? ("info" as LogLevel);

  const storeRaw = env.MCP_READER_STORE ?? "memory";
  const store = storeRaw.startsWith("file")
    ? {
        type: "file" as const,
        dir: storeRaw.includes(":")
          ? storeRaw.slice(storeRaw.indexOf(":") + 1)
          : path.resolve(process.cwd(), ".mcp-reader-artifacts")
      }
    : ({ type: "memory" } as const);

  const artifacts: ArtifactConfig = {
    store,
    maxBytes: parseIntSafe(env.MCP_READER_MAX_BYTES) ?? 80000,
    previewMaxChars: parseIntSafe(env.MCP_READER_PREVIEW_MAX_CHARS) ?? 6000,
    headLines: parseIntSafe(env.MCP_READER_HEAD_LINES) ?? 60,
    tailLines: parseIntSafe(env.MCP_READER_TAIL_LINES) ?? 60,
    ttlSeconds: parseIntSafe(env.MCP_READER_TTL_SECONDS),
    maxArtifacts: parseIntSafe(env.MCP_READER_MAX_ARTIFACTS)
  };

  const baseFromJson = parseJson<ReaderClientConfig>(
    env.MCP_READER_CLIENT_OPTIONS,
    {}
  );

  const readerClient: ReaderClientConfig = {
    ...baseFromJson,
    verbose: parseBool(env.MCP_READER_VERBOSE) ?? baseFromJson.verbose,
    showChrome: parseBool(env.MCP_READER_SHOW_CHROME) ?? baseFromJson.showChrome,
    proxyRotation:
      (env.MCP_READER_PROXY_ROTATION as ProxyRotation | undefined) ??
      baseFromJson.proxyRotation,
    proxies:
      parseJson<ProxyConfig[] | undefined>(env.MCP_READER_PROXIES, undefined) ??
      baseFromJson.proxies,
    browserPool:
      parseJson<BrowserPoolConfig | undefined>(
        env.MCP_READER_BROWSER_POOL,
        undefined
      ) ?? baseFromJson.browserPool
  };

  return {
    logLevel,
    artifacts,
    readerClient
  };
}
