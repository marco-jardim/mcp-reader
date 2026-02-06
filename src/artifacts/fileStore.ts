import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { nanoid } from "nanoid";

import type { ArtifactMeta, ArtifactStore, PutArtifactArgs } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}

function assertSafeId(id: string): void {
  if (!/^art_[A-Za-z0-9_-]{8,}$/.test(id)) {
    throw new Error("Invalid artifact id");
  }
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWriteFile(filePath: string, data: Buffer | string): Promise<void> {
  const tmpPath = `${filePath}.tmp_${nanoid(8)}`;
  await fs.writeFile(tmpPath, data);
  await fs.rename(tmpPath, filePath);
}

export class FileArtifactStore implements ArtifactStore {
  constructor(private readonly dir: string) {}

  private metaPath(id: string): string {
    assertSafeId(id);
    return path.join(this.dir, `${id}.meta.json`);
  }

  private dataPath(id: string): string {
    assertSafeId(id);
    return path.join(this.dir, `${id}.txt.gz`);
  }

  async put(args: PutArtifactArgs): Promise<ArtifactMeta> {
    await ensureDir(this.dir);

    const createdAt = nowIso();
    const id = `art_${nanoid(16)}`;
    const bytes = Buffer.byteLength(args.text, "utf8");
    const gz = gzipSync(Buffer.from(args.text, "utf8"));
    const storedBytes = gz.byteLength;

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
      attributes: args.attributes
    };

    await atomicWriteFile(this.dataPath(id), gz);
    await atomicWriteFile(this.metaPath(id), JSON.stringify(meta, null, 2));
    return meta;
  }

  async getText(id: string): Promise<{ meta: ArtifactMeta; text: string }> {
    const meta = await this.info(id);

    meta.accessCount += 1;
    meta.lastAccessAt = nowIso();
    await atomicWriteFile(this.metaPath(id), JSON.stringify(meta, null, 2));

    const gz = await fs.readFile(this.dataPath(id));
    const buf = gunzipSync(gz);
    return { meta, text: buf.toString("utf8") };
  }

  async info(id: string): Promise<ArtifactMeta> {
    const metaRaw = await fs.readFile(this.metaPath(id), "utf8");
    const meta = JSON.parse(metaRaw) as ArtifactMeta;
    return meta;
  }

  async list(limit: number): Promise<ArtifactMeta[]> {
    await ensureDir(this.dir);
    const entries = await fs.readdir(this.dir);
    const metaFiles = entries.filter((e) => e.endsWith(".meta.json"));

    const metas: ArtifactMeta[] = [];
    for (const file of metaFiles) {
      try {
        const raw = await fs.readFile(path.join(this.dir, file), "utf8");
        metas.push(JSON.parse(raw) as ArtifactMeta);
      } catch {
        // ignore corrupt
      }
    }

    metas.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return metas.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    try {
      await fs.unlink(this.metaPath(id));
    } catch {
      // ignore
    }
    try {
      await fs.unlink(this.dataPath(id));
    } catch {
      // ignore
    }
  }
}
