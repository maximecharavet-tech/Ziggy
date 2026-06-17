import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const svgPath = resolve(root, "public/favicon.svg");
const svg = readFileSync(svgPath);

const sizes = [192, 512];

for (const size of sizes) {
  const output = resolve(root, `public/icons/icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(output);
  console.log(`Generated ${output}`);
}
