// Run manually by the maintainer on Windows. Signing keys never enter CI/PR jobs.
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const version = option("--version"), runId = option("--run"), signingKey = option("--signing-key");
if (process.platform !== "win32" || !/^\d+\.\d+\.\d+$/.test(version ?? "") || !/^\d+$/.test(runId ?? "") || !args.includes("--signing-key")) throw new Error("Uso en Windows: node scripts/prepare-update.mjs --version X.Y.Z --run ID --signing-key RUTA_PRIVADA");
const repository = "JosuaPerez/clavelocal";
const gh = (...parameters) => execFileSync("gh", parameters, { encoding: "utf8", windowsHide: true });
const run = JSON.parse(gh("api", `repos/${repository}/actions/runs/${runId}`));
if (run.head_branch !== "main" || !["push", "workflow_dispatch"].includes(run.event) || run.conclusion !== "success" || run.name !== "Windows") throw new Error("Solo se aceptan compilaciones Windows satisfactorias de main en el repositorio oficial.");
const checks = JSON.parse(gh("api", `repos/${repository}/commits/${run.head_sha}/check-runs?per_page=100`));
for (const name of ["app-tests", "codeql", "windows-installer"]) {
  if (!checks.check_runs.some((check) => check.name === name && check.app.id === 15368 && check.conclusion === "success")) throw new Error(`Falta un check satisfactorio del commit: ${name}`);
}
const config = JSON.parse(await readFile("src-tauri/tauri.conf.json", "utf8"));
if (config.version !== version) throw new Error("La versión no coincide con la configuración local revisada.");
const output = resolve(`work/release-v${version}`);
await mkdir(output); // Do not overwrite a previous release preparation.
const source = resolve(output, "source");
gh("run", "download", runId, "--repo", repository, "--name", "clavelocal-windows-preview", "--dir", source);
const filename = `ClaveLocal_${version}_x64-setup.exe`;
const installer = resolve(source, "target/release/bundle/nsis", filename);
const verifier = resolve(source, "target/release/verify-update.exe");
const bytes = await readFile(installer);
const digest = createHash("sha256").update(bytes).digest("hex");
const sums = await readFile(resolve(source, "target/release/bundle/nsis/SHA256SUMS.txt"), "utf8");
if (!sums.trim().split(/\s+/).includes(digest) || !sums.includes(filename)) throw new Error("El instalador no coincide con su hash de compilación.");
execFileSync(process.execPath, [resolve("node_modules/@tauri-apps/cli/tauri.js"), "signer", "sign", "--app-version", version, "--private-key-path", resolve(signingKey), installer], { stdio: "pipe", windowsHide: true, env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "" } });
const signatureFile = `${installer}.sig`;
const pubkey = config.plugins.updater.pubkey;
execFileSync(verifier, [installer, signatureFile, pubkey, version], { windowsHide: true });
const tampered = resolve(output, "tampered-test.exe");
const modified = Buffer.from(bytes); modified[modified.length - 1] ^= 1;
await writeFile(tampered, modified);
for (const parameters of [[tampered, signatureFile, pubkey, version], [installer, signatureFile, pubkey, "999.999.999"]]) {
  const result = spawnSync(verifier, parameters, { windowsHide: true });
  if (result.error || result.status !== 1) throw new Error("Falló la prueba negativa de la firma; no publicar.");
}
const signature = (await readFile(signatureFile, "utf8")).trim();
const manifest = {
  version,
  notes: "Importación CSV de Chrome/Brave con vista previa, actualizaciones verificadas e iconos de escritorio. Exporta una copia cifrada antes de instalar. Versión experimental sin firma de editor de Windows.",
  pub_date: new Date().toISOString(),
  platforms: { "windows-x86_64": { signature, url: `https://github.com/${repository}/releases/download/v${version}/${filename}` } },
};
await writeFile(resolve(output, "windows.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(resolve(output, "release-info.json"), `${JSON.stringify({ version, runId, commit: run.head_sha, sha256: digest, signatureVerified: true, tamperedFileRejected: true, wrongVersionRejected: true }, null, 2)}\n`);
await copyFile(installer, resolve(output, filename));
await copyFile(signatureFile, resolve(output, `${filename}.sig`));
await copyFile(resolve(source, "target/release/bundle/nsis/SHA256SUMS.txt"), resolve(output, "SHA256SUMS.txt"));
console.log(`Preparado y verificado: ${output}. Todavía no se ha publicado ni se ha cambiado el canal de actualización.`);
