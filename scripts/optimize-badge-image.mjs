import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw new Error("Usage: node scripts/optimize-badge-image.mjs <source> <destination>");
await mkdir(dirname(destination), { recursive: true });
await sharp(source)
  .resize(512, 512, { fit: "contain" })
  .webp({ quality: 88, effort: 6 })
  .toFile(destination);
console.log(destination);
