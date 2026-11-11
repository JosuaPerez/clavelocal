import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.CLAVELOCAL_PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const allowed = new Set(["/", "/index.html", "/styles.css", "/app.js", "/vault.mjs", "/csv.mjs", "/profile.mjs", "/session.mjs", "/clipboard.mjs", "/settings.mjs", "/strength.mjs", "/common-passwords.mjs"]);

export const server = createServer(async (request, response) => {
  if (!new Set([`127.0.0.1:${port}`, `localhost:${port}`]).has(request.headers.host) || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(403).end("Acceso denegado");
    return;
  }
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  if (!allowed.has(pathname)) {
    response.writeHead(404).end("No encontrado");
    return;
  }
  const target = resolve(root, `.${pathname}`);
  if (!target.startsWith(`${resolve(root)}${sep}`)) {
    response.writeHead(403).end("Acceso denegado");
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, { "Content-Type": types[extname(target)] ?? "application/octet-stream" }).end(body);
  } catch {
    response.writeHead(404).end("No encontrado");
  }
});

if (process.env.CLAVELOCAL_NO_AUTOSTART !== "1") {
  function reportServerError(error) {
    console.error(error.code === "EADDRINUSE"
      ? `El puerto ${port} ya está en uso. Otro programa podría estar imitando a ClaveLocal: no abras esa dirección con tu bóveda. Cierra el programa que ocupa el puerto o elige otro con CLAVELOCAL_PORT. Un puerto distinto usa otro almacenamiento y no verá tu bóveda actual.`
      : "No se pudo iniciar el servidor local de ClaveLocal. Revisa el puerto y los permisos, y vuelve a intentarlo.");
    process.exitCode = 1;
  }
  server.on("error", reportServerError);
  try {
    server.listen(port, "127.0.0.1", () => {
      const address = `http://127.0.0.1:${port}`;
      console.log(`ClaveLocal está abierto en ${address}`);
      if (process.env.CLAVELOCAL_NO_OPEN === "1") return;
      const browser = process.platform === "win32" ? ["cmd", ["/c", "start", "", address]] : process.platform === "darwin" ? ["open", [address]] : ["xdg-open", [address]];
      const child = spawn(browser[0], browser[1], { detached: true, stdio: "ignore", windowsHide: true });
      child.unref();
    });
  } catch (error) { reportServerError(error); }

  process.on("SIGINT", () => server.close(() => process.exit(0)));
}
