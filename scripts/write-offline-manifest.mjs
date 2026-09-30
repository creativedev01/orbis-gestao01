import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../dist/client/", import.meta.url).pathname;
const staticRoot = join(root, "_next/static");
const files = [];
function visit(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) visit(path);
    else files.push("/" + relative(root, path).split("/").join("/"));
  }
}
visit(staticRoot);
writeFileSync(join(root, "offline-assets.json"), JSON.stringify(files));
console.log(`Arquivos para uso offline: ${files.length}`);
