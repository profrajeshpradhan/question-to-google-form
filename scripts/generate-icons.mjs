// Generates PNG app icons from the SVG sources. Run: npm run icons
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const icon = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
const maskable = await readFile(new URL("../public/icons/maskable.svg", import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

for (const size of [192, 512]) {
  await sharp(icon, { density: 1200 }).resize(size, size).png().toFile(out(`icon-${size}.png`));
  await sharp(maskable, { density: 1200 }).resize(size, size).png().toFile(out(`maskable-${size}.png`));
}
await sharp(maskable, { density: 1200 }).resize(180, 180).png().toFile(out("apple-touch-icon.png"));
console.log("icons generated");
