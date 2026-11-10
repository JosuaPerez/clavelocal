import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";

const files = ["index.html", "styles.css", "app.js", "vault.mjs", "csv.mjs", "profile.mjs", "session.mjs"];
for (const directory of ["dist", "site/demo"]) {
  await mkdir(directory, { recursive: true });
  for (const file of files) await copyFile(file, `${directory}/${file}`);
}
let html = await readFile("index.html", "utf8");
await writeFile("dist/index.html", html.replace("connect-src 'none'", "connect-src 'self' ipc: http://ipc.localhost"));
html = html.replace('<html lang="es">', '<html lang="es" data-mode="demo">');
await writeFile("site/demo/index.html", html);
await copyFile("web/index.html", "site/index.html");
await copyFile("web/landing.css", "site/landing.css");
await mkdir("site/assets", { recursive: true });
await copyFile("assets/clavelocal-launch.png", "site/assets/clavelocal-launch.png");
try {
  const updates = await readFile("web/updates/windows.json");
  await mkdir("site/updates", { recursive: true });
  await writeFile("site/updates/windows.json", updates);
} catch (error) { if (error.code !== "ENOENT") throw error; }
console.log("App de escritorio y demo pública preparadas por separado.");
