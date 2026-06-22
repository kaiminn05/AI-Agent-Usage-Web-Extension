import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = path.join(root, "src/assets/agent-usage-icon.svg");
const outDir = path.join(root, "public/icons");
const sizes = [16, 32, 48, 128];

await mkdir(outDir, { recursive: true });

for (const size of sizes) {
  const buffer = await sharp(source).resize(size, size).png().toBuffer();
  await writeFile(path.join(outDir, `icon-${size}.png`), buffer);
}

await copyFile(source, path.join(root, "public/agent-usage-icon.svg"));

console.log(`Generated ${sizes.length} icons in public/icons/`);
