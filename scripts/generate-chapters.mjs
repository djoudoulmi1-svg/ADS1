import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = await readdir(root);
const chapterFiles = files
  .map(file => ({ file, match: /^chapter(\d+)\.html$/i.exec(file) }))
  .filter(entry => entry.match)
  .sort((left, right) => Number(left.match[1]) - Number(right.match[1]));

const chapters = await Promise.all(chapterFiles.map(async ({ file, match }) => {
  const html = await readFile(resolve(root, file), "utf8");
  const readMeta = name => {
    const tag = html.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, "i"));
    return tag?.[1]?.trim() ?? "";
  };
  const title = readMeta("hub-title");
  if (!title) {
    throw new Error(`${file} is missing <meta name="hub-title" content="...">`);
  }
  const number = Number(match[1]);
  return {
    id: String(number),
    number: String(number).padStart(2, "0"),
    title,
    available: true,
    file,
    sectionCount: readMeta("hub-sections") || "Course lesson",
    description: readMeta("hub-description")
  };
}));

await writeFile(resolve(root, "chapters.json"), `${JSON.stringify(chapters, null, 2)}\n`);
console.log(`Generated chapters.json with ${chapters.length} chapter(s).`);