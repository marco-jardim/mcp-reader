import { describe, expect, it } from "vitest";

import { sliceText } from "../src/artifacts/slice.js";

describe("sliceText", () => {
  const text = Array.from({ length: 200 }, (_, i) => `line-${i + 1}`).join("\n");

  it("head returns numbered lines", () => {
    const out = sliceText(text, { mode: "head", headLines: 3, maxBytes: 10000 });
    expect(out).toContain("     1| line-1");
    expect(out).toContain("     3| line-3");
  });

  it("tail returns numbered lines", () => {
    const out = sliceText(text, { mode: "tail", tailLines: 2, maxBytes: 10000 });
    expect(out).toContain("   199| line-199");
    expect(out).toContain("   200| line-200");
  });

  it("range returns numbered slice", () => {
    const out = sliceText(text, {
      mode: "range",
      startLine: 10,
      endLine: 12,
      maxBytes: 10000
    });
    expect(out).toContain("    10| line-10");
    expect(out).toContain("    12| line-12");
  });

  it("grep finds substring matches", () => {
    const out = sliceText(text, {
      mode: "grep",
      pattern: "line-42",
      maxBytes: 10000
    });
    expect(out).toContain("    42| line-42");
  });
});
