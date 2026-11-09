import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("site");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png" };
createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://127.0.0.1:4174").pathname;
    const target = resolve(root, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
    if (!target.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
    response.writeHead(200, { "Content-Type": types[extname(target)] ?? "application/octet-stream" });
    response.end(await readFile(target));
  } catch { response.end(); }
}).listen(4174, "127.0.0.1", () => console.log("Demo: http://127.0.0.1:4174"));
