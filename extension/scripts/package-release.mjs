import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(root, "..");
const manifest = readFileSync(
  path.join(extensionRoot, "manifest.config.ts"),
  "utf8",
);
const version = manifest.match(/version:\s*"([^"]+)"/)?.[1] ?? "0.0.0";
const zipName = `agent-usage-v${version}.zip`;
const zipPath = path.join(extensionRoot, zipName);

execSync("npm run build", { cwd: extensionRoot, stdio: "inherit" });
execSync(`zip -r "${zipPath}" .`, {
  cwd: path.join(extensionRoot, "dist"),
  stdio: "inherit",
});

console.log(`\nRelease zip ready: extension/${zipName}`);
console.log("Upload to GitHub → Releases, or push a tag: git tag v" + version);
