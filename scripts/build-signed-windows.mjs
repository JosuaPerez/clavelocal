import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
if (process.platform !== "win32") throw new Error("La firma Authenticode se prepara en Windows.");
const thumbprint = process.env.CLAVELOCAL_CERT_THUMBPRINT;
if (!/^[a-fA-F0-9]{40}$/.test(thumbprint ?? "")) throw new Error("Configura CLAVELOCAL_CERT_THUMBPRINT con la huella de un certificado de firma de código válido del almacén de Windows. No se usará un certificado autofirmado.");
const config = { bundle: { windows: { certificateThumbprint: thumbprint, digestAlgorithm: "sha256", timestampUrl: "http://timestamp.digicert.com" } } };
execFileSync(process.execPath, [resolve("node_modules/@tauri-apps/cli/tauri.js"), "build", "--config", JSON.stringify(config), "--", "--locked"], { stdio: "inherit" });
