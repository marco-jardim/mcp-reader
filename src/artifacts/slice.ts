export type SliceMode = "auto" | "head" | "tail" | "range" | "grep" | "full" | "json";

export interface SliceArgs {
  mode: SliceMode;
  pattern?: string;
  startLine?: number;
  endLine?: number;
  headLines?: number;
  tailLines?: number;
  maxLines?: number;
  maxBytes?: number;
  previewMaxChars?: number;
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function formatNumbered(lines: string[], startLine: number): string {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNo = startLine + i;
    out.push(`${String(lineNo).padStart(6, " ")}| ${lines[i]}`);
  }
  return out.join("\n");
}

function clampTextBytes(text: string, maxBytes: number): string {
  const buf = Buffer.from(text, "utf8");
  if (buf.byteLength <= maxBytes) return text;
  return buf.subarray(0, maxBytes).toString("utf8") +
    `\n[truncated to ${maxBytes} bytes]`;
}

function parseRegex(pattern: string): RegExp | null {
  // Support /.../i format
  if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
    const last = pattern.lastIndexOf("/");
    const body = pattern.slice(1, last);
    const flags = pattern.slice(last + 1);
    try {
      return new RegExp(body, flags);
    } catch {
      return null;
    }
  }
  return null;
}

function buildAutoPreview(text: string, headLines: number, tailLines: number): string {
  const lines = splitLines(text);
  const head = lines.slice(0, headLines);
  const tail = lines.slice(Math.max(0, lines.length - tailLines));

  const errorRegex = /(error|exception|traceback|failed|fatal|denied)/i;
  const errorHits: Array<{ i: number; line: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (errorRegex.test(lines[i] ?? "")) {
      errorHits.push({ i, line: lines[i] ?? "" });
      if (errorHits.length >= 20) break;
    }
  }

  const parts: string[] = [];
  if (errorHits.length > 0) {
    parts.push("Error excerpts (first 20 matches):");
    parts.push(
      errorHits
        .map((h) => `${String(h.i + 1).padStart(6, " ")}| ${h.line}`)
        .join("\n")
    );
    parts.push("");
  }

  parts.push(`Head (${head.length} lines):`);
  parts.push(formatNumbered(head, 1));
  parts.push("");
  parts.push(`Tail (${tail.length} lines):`);
  parts.push(formatNumbered(tail, Math.max(1, lines.length - tail.length + 1)));

  return parts.join("\n");
}

export function sliceText(text: string, args: SliceArgs): string {
  const mode = args.mode;
  const maxLinesDefault = args.maxLines ?? 400;
  const maxBytes = args.maxBytes ?? 200000;
  const headLines = args.headLines ?? 60;
  const tailLines = args.tailLines ?? 60;

  const lines = splitLines(text);

  let out = "";
  if (mode === "auto") {
    out = buildAutoPreview(text, headLines, tailLines);
    const maxChars = args.previewMaxChars;
    if (maxChars && out.length > maxChars) {
      out = out.slice(0, maxChars) + `\n[truncated to ${maxChars} chars]`;
    }
  } else if (mode === "head") {
    out = formatNumbered(lines.slice(0, Math.min(headLines, maxLinesDefault)), 1);
  } else if (mode === "tail") {
    const slice = lines.slice(
      Math.max(0, lines.length - Math.min(tailLines, maxLinesDefault))
    );
    out = formatNumbered(slice, Math.max(1, lines.length - slice.length + 1));
  } else if (mode === "range") {
    const start = Math.max(1, args.startLine ?? 1);
    const end = Math.max(start, args.endLine ?? start);
    const slice = lines.slice(start - 1, Math.min(end, lines.length));
    out = formatNumbered(slice.slice(0, maxLinesDefault), start);
  } else if (mode === "grep") {
    const pattern = args.pattern ?? "";
    const rx = parseRegex(pattern);
    const needle = rx ? null : pattern.toLowerCase();

    const hits: Array<{ idx: number; line: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const ok = rx ? rx.test(line) : needle ? line.toLowerCase().includes(needle) : false;
      if (ok) {
        hits.push({ idx: i, line });
        if (hits.length >= maxLinesDefault) break;
      }
    }

    out = hits
      .map((h) => `${String(h.idx + 1).padStart(6, " ")}| ${h.line}`)
      .join("\n");
    if (out.length === 0) out = "[no matches]";
  } else {
    // full/json: return raw text (byte-capped)
    out = text;
    if (args.maxLines !== undefined && lines.length > args.maxLines) {
      const slice = lines.slice(0, args.maxLines);
      out =
        formatNumbered(slice, 1) +
        `\n[truncated to ${args.maxLines} lines; use mode=range to fetch more]`;
    }
  }

  return clampTextBytes(out, maxBytes);
}
