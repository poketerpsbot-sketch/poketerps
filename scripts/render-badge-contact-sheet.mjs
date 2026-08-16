import { readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const source = join(process.cwd(), "public", "badges", "v2");
const destination = process.argv[2] ?? join(process.cwd(), ".tmp-badge-contact-sheet.png");
const files = (await readdir(source)).filter((file) => /\.(svg|webp)$/.test(file)).sort();
const cell = { width: 180, height: 180 };
const columns = 4;
const rows = Math.ceil(files.length / columns);
const composites = [];
for (const [index, file] of files.entries()) {
  const icon = await sharp(join(source, file))
    .resize(124, 124, { fit: "contain" })
    .png()
    .toBuffer();
  const label = Buffer.from(
    `<svg width="${cell.width}" height="40"><text x="90" y="18" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="#171918">${file.replace(/\.(svg|webp)$/, "")}</text></svg>`,
  );
  const left = (index % columns) * cell.width;
  const top = Math.floor(index / columns) * cell.height;
  composites.push({ input: icon, left: left + 28, top: top + 8 });
  composites.push({ input: label, left, top: top + 136 });
}
await sharp({
  create: {
    width: columns * cell.width,
    height: rows * cell.height,
    channels: 4,
    background: "#f5eee2",
  },
})
  .composite(composites)
  .png()
  .toFile(destination);
console.log(destination);
