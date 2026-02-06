export type ArtifactContentType =
  | "text/plain"
  | "text/markdown"
  | "text/html"
  | "application/json";

export interface ArtifactMeta {
  id: string;
  tool: string;
  contentType: ArtifactContentType;
  encoding: "utf-8";
  bytes: number;
  storedBytes: number;
  lineCount: number;
  createdAt: string;
  lastAccessAt: string;
  accessCount: number;
  expiresAt?: string;
  attributes?: Record<string, string>;
}

export interface PutArtifactArgs {
  tool: string;
  contentType: ArtifactContentType;
  text: string;
  attributes?: Record<string, string>;
}

export interface ArtifactStore {
  put(args: PutArtifactArgs): Promise<ArtifactMeta>;
  getText(id: string): Promise<{ meta: ArtifactMeta; text: string }>;
  info(id: string): Promise<ArtifactMeta>;
  list(limit: number): Promise<ArtifactMeta[]>;
  delete(id: string): Promise<void>;
}
