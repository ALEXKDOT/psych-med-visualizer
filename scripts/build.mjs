import { copyFile, lstat, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist");
// Explicit public assets only. Never copy a working directory, journal backup,
// private configuration, documentation, tests, or development server wholesale.
const assets = [
  "index.html",
  "styles.css",
  "favicon.svg",
  "src/app.mjs",
  "src/model.mjs",
  "src/charts.mjs",
  "src/portability.mjs"
];

// Check all sources before replacing a previous build. Symlinks are not assets.
for (const asset of assets) {
  const metadata = await lstat(join(root, asset));
  if (!metadata.isFile()) throw new Error(`Expected a regular public asset: ${asset}`);
}

await rm(output, { recursive: true, force: true });
for (const asset of assets) {
  const destination = join(output, asset);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, asset), destination);
}
console.log(`Built ${assets.length} public assets in dist/. No journal data or backups are included.`);
