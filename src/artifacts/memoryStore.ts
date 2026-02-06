import { gzipSync, gunzipSync } from "node:zlib";
import { nanoid } from "nanoid";

import type { ArtifactMeta, ArtifactStore, PutArtifactArgs } from "./types.js";

type Stored = { meta: ArtifactMeta; gz: Buffer };

function nowIso(): string {
  return new Date().toISOString();
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  // Count \n; add 1 if not ending with \n
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}

export class MemoryArtifactStore implements ArtifactStore {
  private readonly byId = new Map<string, Stored>();

  constructor(
    private readonly opts: {
      ttlSeconds?: number;
      maxArtifacts?: number;
    }
  ) {}

  async put(args: PutArtifactArgs): Promise<ArtifactMeta> {
    this.evictExpired();

    const createdAt = nowIso();
    const id = `art_${nanoid(16)}`;
    const bytes = Buffer.byteLength(args.text, "utf8");
    const gz = gzipSync(Buffer.from(args.text, "utf8"));
    const storedBytes = gz.byteLength;

    const expiresAt = this.opts.ttlSeconds
      ? new Date(Date.now() + this.opts.ttlSeconds * 1000).toISOString()
      : undefined;

    const meta: ArtifactMeta = {
      id,
      tool: args.tool,
      contentType: args.contentType,
      encoding: "utf-8",
      bytes,
      storedBytes,
      lineCount: countLines(args.text),
      createdAt,
      lastAccessAt: createdAt,
      accessCount: 0,
      expiresAt,
      attributes: args.attributes
    };

    this.byId.set(id, { meta, gz });
    this.enforceMax();
    return meta;
  }

  async getText(id: string): Promise<{ meta: ArtifactMeta; text: string }> {
    this.evictExpired();

    const stored = this.byId.get(id);
    if (!stored) {
      throw new Error(`Artifact not found: ${id}`);
    }

    stored.meta.accessCount += 1;
    stored.meta.lastAccessAt = nowIso();

    const buf = gunzipSync(stored.gz);
    return { meta: stored.meta, text: buf.toString("utf8") };
  }

  async info(id: string): Promise<ArtifactMeta> {
    this.evictExpired();
    const stored = this.byId.get(id);
    if (!stored) throw new Error(`Artifact not found: ${id}`);
    return stored.meta;
  }

  async list(limit: number): Promise<ArtifactMeta[]> {
    this.evictExpired();
    const all = Array.from(this.byId.values()).map((s) => s.meta);
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return all.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [id, stored] of this.byId.entries()) {
      if (!stored.meta.expiresAt) continue;
      const t = Date.parse(stored.meta.expiresAt);
      if (Number.isFinite(t) && t <= now) {
        this.byId.delete(id);
      }
    }
  }

  private enforceMax(): void {
    const max = this.opts.maxArtifacts;
    if (!max || this.byId.size <= max) return;

    const metas = Array.from(this.byId.values()).map((s) => s.meta);
    metas.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const toRemove = metas.length - max;
    for (let i = 0; i < toRemove; i++) {
      this.byId.delete(metas[i]!.id);
    }
  }
}
