import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";

const files = ["index.html", "styles.css", "app.js", "vault.mjs"];
for (const directory of ["dist", "site/demo"]) {
  await mkdir(directory, { recursive: true });
  for (const file of files) await copyFile(file, `${directory}/${file}`);
}
let html = await readFile("index.html", "utf8");
html = html.replace('<html lang="es">', '<html lang="es" data-mode="demo">');
await writeFile("site/demo/index.html", html);
await copyFile("web/index.html", "site/index.html");
await copyFile("web/landing.css", "site/landing.css");
await mkdir("site/assets", { recursive: true });
await copyFile("assets/clavelocal-launch.png", "site/assets/clavelocal-launch.png");
console.log("App de escritorio y demo pública preparadas por separado.");
