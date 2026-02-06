import path from "node:path";

import type { ArtifactConfig } from "../config.js";
import type { ArtifactStore } from "./types.js";
import { FileArtifactStore } from "./fileStore.js";
import { MemoryArtifactStore } from "./memoryStore.js";

export function createArtifactStore(cfg: ArtifactConfig): ArtifactStore {
  if (cfg.store.type === "file") {
    const dir = path.isAbsolute(cfg.store.dir)
      ? cfg.store.dir
      : path.resolve(process.cwd(), cfg.store.dir);
    return new FileArtifactStore(dir);
  }

  return new MemoryArtifactStore({
    ttlSeconds: cfg.ttlSeconds,
    maxArtifacts: cfg.maxArtifacts
  });
}
