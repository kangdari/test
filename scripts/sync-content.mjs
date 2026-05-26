import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const sourceRoot = "/Users/lupin/Documents/Obsidian Vault/poe2/unique-items";
const fontSource =
  "/Users/lupin/Downloads/Pretendard-1.3.9/web/variable/woff2/PretendardVariable.woff2";

await mkdir("content", { recursive: true });
await mkdir("public/item-images", { recursive: true });
await mkdir("public/fonts", { recursive: true });

await cp(path.join(sourceRoot, "unique-items-kr.md"), "content/unique-items-kr.md");
await cp(path.join(sourceRoot, "unique-items-en.md"), "content/unique-items-en.md");
await cp(path.join(sourceRoot, "images"), "public/item-images", {
  recursive: true,
});
await cp(fontSource, "public/fonts/PretendardVariable.woff2");

console.log("Synced Markdown, item images, and Pretendard font.");
