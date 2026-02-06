import type { ReaderClientConfig } from "../config.js";
import type { Logger } from "../logger.js";

type ReaderClientLike = {
  scrape: (options: unknown) => Promise<unknown>;
  crawl: (options: unknown) => Promise<unknown>;
  start?: () => Promise<unknown> | unknown;
  isReady?: () => Promise<unknown> | unknown;
  close?: () => Promise<unknown> | unknown;
};

type ReaderClientCtor = new (options: unknown) => ReaderClientLike;

type BrowserPoolLike = {
  initialize: () => Promise<unknown>;
  withBrowser: <T>(fn: (hero: unknown) => Promise<T>) => Promise<T>;
  shutdown: () => Promise<unknown>;
};

type BrowserPoolCtor = new (options?: unknown) => BrowserPoolLike;

type DetectChallengeFn = (hero: unknown) => Promise<unknown>;
type WaitForChallengeResolutionFn = (hero: unknown, options?: unknown) => Promise<unknown>;

type ReaderModule = {
  ReaderClient: ReaderClientCtor;
  BrowserPool: BrowserPoolCtor;
  detectChallenge: DetectChallengeFn;
  waitForChallengeResolution: WaitForChallengeResolutionFn;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function hasFn(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === "function";
}

function isReaderModule(mod: unknown): mod is ReaderModule {
  if (!isObject(mod)) return false;
  return (
    typeof mod.ReaderClient === "function" &&
    typeof mod.BrowserPool === "function" &&
    hasFn(mod, "detectChallenge") &&
    hasFn(mod, "waitForChallengeResolution")
  );
}

async function loadReaderModule(): Promise<ReaderModule> {
  try {
    // Keep the specifier non-literal so TypeScript doesn't require the optional dependency at typecheck time.
    const specifier: string = "@vakra-dev/reader";
    const mod: unknown = await import(specifier);
    if (!isReaderModule(mod)) {
      throw new Error(
        "@vakra-dev/reader loaded but expected exports were not found (ReaderClient/BrowserPool/detectChallenge/waitForChallengeResolution)."
      );
    }
    return mod;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      [
        "Unable to load @vakra-dev/reader.",
        "This MCP expects @vakra-dev/reader to be installed (it is an optional dependency so installs can succeed even if native modules fail).",
        "Fix:",
        "1) Use Node >=24 (recommended: Node 24.x).",
        "2) Run: npm i @vakra-dev/reader",
        `Original error: ${message}`
      ].join(" ")
    );
  }
}

function isHeroLike(hero: unknown): hero is { goto: (url: string) => Promise<unknown> } {
  return isObject(hero) && typeof hero.goto === "function";
}

export class ReaderRuntime {
  private modulePromise: Promise<ReaderModule> | null = null;
  private client: ReaderClientLike | null = null;
  private challengePool: BrowserPoolLike | null = null;

  constructor(
    private readonly cfg: ReaderClientConfig,
    private readonly logger: Logger
  ) {}

  private async mod(): Promise<ReaderModule> {
    if (!this.modulePromise) this.modulePromise = loadReaderModule();
    return this.modulePromise;
  }

  private async getClient(): Promise<ReaderClientLike> {
    if (this.client) return this.client;
    const { ReaderClient } = await this.mod();
    this.client = new ReaderClient(this.cfg);
    return this.client;
  }

  async warmup(): Promise<void> {
    const client = await this.getClient();
    if (typeof client.start === "function") {
      await client.start();
    }
  }

  async isReady(): Promise<boolean> {
    if (!this.client) return false;
    if (typeof this.client.isReady !== "function") return true;
    const res = await this.client.isReady();
    return typeof res === "boolean" ? res : true;
  }

  async close(): Promise<void> {
    if (this.client && typeof this.client.close === "function") {
      await this.client.close();
    }
    this.client = null;

    if (this.challengePool) {
      await this.challengePool.shutdown();
    }
    this.challengePool = null;
  }

  async scrape(options: unknown): Promise<unknown> {
    const client = await this.getClient();
    return await client.scrape(options);
  }

  async crawl(options: unknown): Promise<unknown> {
    const client = await this.getClient();
    return await client.crawl(options);
  }

  async detectChallenge(args: {
    url: string;
    waitForResolution?: boolean;
    maxWaitMs?: number;
    pollIntervalMs?: number;
    verbose?: boolean;
  }): Promise<{ challenge: unknown; resolution?: unknown }> {
    const mod = await this.mod();

    if (!this.challengePool) {
      this.challengePool = new mod.BrowserPool();
      await this.challengePool.initialize();
    }

    return await this.challengePool.withBrowser(async (hero) => {
      if (!isHeroLike(hero)) {
        throw new Error("BrowserPool did not provide a Hero-like object");
      }

      await hero.goto(args.url);
      const challenge = await mod.detectChallenge(hero);
      let resolution: unknown | undefined;

      if (args.waitForResolution) {
        resolution = await mod.waitForChallengeResolution(hero, {
          maxWaitMs: args.maxWaitMs,
          pollIntervalMs: args.pollIntervalMs,
          verbose: args.verbose,
          initialUrl: args.url
        });
      }

      return { challenge, resolution };
    });
  }
}
