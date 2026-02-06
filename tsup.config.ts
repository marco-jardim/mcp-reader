import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  target: "node24",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: false,
  outDir: "dist",
  // Keep @vakra-dev/reader external so native deps are resolved at install time.
  external: ["@vakra-dev/reader"]
});
