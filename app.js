"use strict";

const STORAGE_KEY = "clavelocal.vault.v1";
const INACTIVITY_MS = 5 * 60 * 1000;
const PBKDF2_ITERATIONS = 310000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const state = {
  key: null,
  vault: { version: 1, entries: [] },
  filter: "all",
  inactivityTimer: null,
  clipboardTimer: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  welcomeView: $("#welcomeView"), vaultView: $("#vaultView"), lockButton: $("#lockButton"),
  authForm: $("#authForm"), masterPassword: $("#masterPassword"), confirmPassword: $("#confirmPassword"),
  confirmGroup: $("#confirmGroup"), authKicker: $("#authKicker"), authTitle: $("#authTitle"),
  authDescription: $("#authDescription"), authSubmit: $("#authSubmit"), authError: $("#authError"),
  allCount: $("#allCount"), favoriteCount: $("#favoriteCount"), categoryNav: $("#categoryNav"),
  searchInput: $("#searchInput"), entryList: $("#entryList"), emptyState: $("#emptyState"),
  entryDialog: $("#entryDialog"), entryForm: $("#entryForm"), entryDialogTitle: $("#entryDialogTitle"),
  entryId: $("#entryId"), entrySite: $("#entrySite"), entryUsername: $("#entryUsername"),
  entryCategory: $("#entryCategory"), entryPassword: $("#entryPassword"), entryNotes: $("#entryNotes"),
  entryError: $("#entryError"), entryStrengthFill: $("#entryStrengthFill"), entryStrengthLabel: $("#entryStrengthLabel"),
  generatorDialog: $("#generatorDialog"), generatedPassword: $("#generatedPassword"),
  passwordLength: $("#passwordLength"), lengthValue: $("#lengthValue"), generatorStrengthFill: $("#generatorStrengthFill"),
  generatorStrengthLabel: $("#generatorStrengthLabel"), toast: $("#toast"), importFile: $("#importFile"),
};

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptVault(key, vault, salt) {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode("clavelocal:v1") },
    key,
    encoder.encode(JSON.stringify(vault))
  );
  return {
    format: "clavelocal-v1",
    kdf: { name: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS, salt: bytesToBase64(salt) },
    cipher: { name: "AES-256-GCM", iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(encrypted)) },
  };
}

async function decryptVault(key, stored) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(stored.cipher.iv), additionalData: encoder.encode("clavelocal:v1") },
    key,
    base64ToBytes(stored.cipher.data)
  );
  const vault = JSON.parse(decoder.decode(decrypted));
  if (!vault || vault.version !== 1 || !Array.isArray(vault.entries)) throw new Error("Formato de bóveda no válido");
  return vault;
}

function getStoredVault() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.format !== "clavelocal-v1" || !value?.kdf?.salt || !value?.cipher?.data) return null;
    return value;
  } catch {
    return null;
  }
}

async function persistVault() {
  if (!state.key) return;
  const current = getStoredVault();
  const salt = current ? base64ToBytes(current.kdf.salt) : randomBytes(16);
  const encrypted = await encryptVault(state.key, state.vault, salt);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
}

function configureAuth() {
  const exists = Boolean(getStoredVault());
  elements.confirmGroup.classList.toggle("hidden", exists);
  elements.confirmPassword.required = !exists;
  elements.masterPassword.autocomplete = exists ? "current-password" : "new-password";
  elements.authKicker.textContent = exists ? "BIENVENIDO DE NUEVO" : "PRIMER ACCESO";
  elements.authTitle.textContent = exists ? "Abre tu bóveda" : "Crea tu bóveda";
  elements.authDescription.textContent = exists
    ? "Introduce tu clave maestra para descifrar tus contraseñas."
    : "Elige una clave maestra. Será la única forma de abrir tus contraseñas.";
  elements.authSubmit.firstChild.textContent = exists ? "Abrir bóveda " : "Crear bóveda ";
}

async function handleAuth(event) {
  event.preventDefault();
  elements.authError.textContent = "";
  const password = elements.masterPassword.value;
  const stored = getStoredVault();

  if (password.length < 12) {
    elements.authError.textContent = "Usa al menos 12 caracteres para tu clave maestra.";
    return;
  }
  if (!stored && password !== elements.confirmPassword.value) {
    elements.authError.textContent = "Las claves no coinciden.";
    return;
  }

  elements.authSubmit.disabled = true;
  try {
    if (stored) {
      const key = await deriveKey(password, base64ToBytes(stored.kdf.salt));
      state.vault = await decryptVault(key, stored);
      state.key = key;
    } else {
      const salt = randomBytes(16);
      state.key = await deriveKey(password, salt);
      state.vault = { version: 1, entries: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(await encryptVault(state.key, state.vault, salt)));
    }
    elements.authForm.reset();
    unlockUi();
  } catch {
    state.key = null;
    elements.authError.textContent = "La clave maestra no es correcta o la bóveda está dañada.";
  } finally {
    elements.authSubmit.disabled = false;
  }
}

function unlockUi() {
  elements.welcomeView.classList.add("hidden");
  elements.vaultView.classList.remove("hidden");
  elements.lockButton.classList.remove("hidden");
  state.filter = "all";
  elements.searchInput.value = "";
  renderEntries();
  resetInactivityTimer();
}

function lockVault(message = "Bóveda bloqueada") {
  state.key = null;
  state.vault = { version: 1, entries: [] };
  clearTimeout(state.inactivityTimer);
  elements.entryDialog.close();
  elements.generatorDialog.close();
  elements.vaultView.classList.add("hidden");
  elements.lockButton.classList.add("hidden");
  elements.welcomeView.classList.remove("hidden");
  configureAuth();
  elements.masterPassword.focus();
  showToast(message);
}

function resetInactivityTimer() {
  if (!state.key) return;
  clearTimeout(state.inactivityTimer);
  state.inactivityTimer = setTimeout(() => lockVault("Bóveda bloqueada por inactividad"), INACTIVITY_MS);
}

function createButton(label, iconPath, handler, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", label);
  button.title = label;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", iconPath);
  svg.append(path);
  button.append(svg);
  button.addEventListener("click", handler);
  return button;
}

function renderEntries() {
  elements.entryList.replaceChildren();
  const query = elements.searchInput.value.trim().toLocaleLowerCase("es");
  const filtered = state.vault.entries
    .filter((entry) => state.filter === "all" || (state.filter === "favorites" ? entry.favorite : entry.category === state.filter))
    .filter((entry) => `${entry.site} ${entry.username}`.toLocaleLowerCase("es").includes(query))
    .sort((a, b) => a.site.localeCompare(b.site, "es"));

  for (const entry of filtered) {
    const card = document.createElement("article");
    card.className = "entry-card";

    const avatar = document.createElement("div");
    avatar.className = "site-avatar";
    avatar.textContent = entry.site.slice(0, 1).toUpperCase();

    const main = document.createElement("div");
    main.className = "entry-main";
    const site = document.createElement("strong");
    site.textContent = entry.site;
    const category = document.createElement("small");
    category.textContent = entry.category;
    main.append(site, category);

    const user = document.createElement("div");
    user.className = "entry-user";
    const username = document.createElement("strong");
    username.textContent = entry.username || "Sin usuario";
    const passwordMask = document.createElement("small");
    passwordMask.textContent = "••••••••••••";
    user.append(username, passwordMask);

    const actions = document.createElement("div");
    actions.className = "entry-actions";
    actions.append(
      createButton(entry.favorite ? "Quitar de favoritas" : "Añadir a favoritas", entry.favorite ? "M12 20.5 3.8 13A5 5 0 0 1 11 6.1l1 .9 1-.9A5 5 0 0 1 20.2 13L12 20.5Z" : "M12 20.5 3.8 13A5 5 0 0 1 11 6.1l1 .9 1-.9A5 5 0 0 1 20.2 13L12 20.5Z", () => toggleFavorite(entry.id)),
      createButton("Copiar contraseña", "M8 8h11v11H8V8Zm-3 8H4V4h12v1", () => copySecret(entry.password)),
      createButton("Editar", "m4 20 4.2-1 10.7-10.7-3.2-3.2L5 15.8 4 20Zm9.8-12.8 3.2 3.2", () => openEntryDialog(entry)),
      createButton("Eliminar", "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5", () => deleteEntry(entry), "danger")
    );
    card.append(avatar, main, user, actions);
    elements.entryList.append(card);
  }

  elements.emptyState.classList.toggle("hidden", filtered.length > 0);
  elements.allCount.textContent = String(state.vault.entries.length);
  elements.favoriteCount.textContent = String(state.vault.entries.filter((entry) => entry.favorite).length);
  renderCategoryNav();
}

function renderCategoryNav() {
  const counts = new Map();
  for (const entry of state.vault.entries) counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
  elements.categoryNav.replaceChildren();
  for (const category of ["Personal", "Trabajo", "Finanzas", "Redes", "Otros"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `nav-item${state.filter === category ? " active" : ""}`;
    const icon = document.createElement("span"); icon.className = "nav-icon"; icon.textContent = "·";
    const label = document.createElement("span"); label.textContent = category;
    const count = document.createElement("b"); count.textContent = String(counts.get(category) || 0);
    button.append(icon, label, count);
    button.addEventListener("click", () => setFilter(category));
    elements.categoryNav.append(button);
  }
  $$("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.filter));
}

function setFilter(filter) {
  state.filter = filter;
  renderEntries();
}

function openEntryDialog(entry = null) {
  elements.entryForm.reset();
  elements.entryError.textContent = "";
  elements.entryId.value = entry?.id || "";
  elements.entrySite.value = entry?.site || "";
  elements.entryUsername.value = entry?.username || "";
  elements.entryCategory.value = entry?.category || "Personal";
  elements.entryPassword.value = entry?.password || generatePassword();
  elements.entryNotes.value = entry?.notes || "";
  elements.entryDialogTitle.textContent = entry ? "Editar contraseña" : "Nueva contraseña";
  updateStrength(elements.entryPassword.value, elements.entryStrengthFill, elements.entryStrengthLabel);
  elements.entryDialog.showModal();
  elements.entrySite.focus();
}

async function saveEntry(event) {
  event.preventDefault();
  elements.entryError.textContent = "";
  const site = elements.entrySite.value.trim();
  const password = elements.entryPassword.value;
  if (!site || !password) {
    elements.entryError.textContent = "El sitio y la contraseña son obligatorios.";
    return;
  }
  const id = elements.entryId.value;
  const existing = state.vault.entries.find((entry) => entry.id === id);
  const entry = {
    id: id || crypto.randomUUID(),
    site,
    username: elements.entryUsername.value.trim(),
    category: elements.entryCategory.value,
    password,
    notes: elements.entryNotes.value.trim(),
    favorite: existing?.favorite || false,
    updatedAt: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, entry);
  else state.vault.entries.push(entry);
  await persistVault();
  elements.entryDialog.close();
  renderEntries();
  showToast(existing ? "Contraseña actualizada" : "Contraseña guardada");
}

async function toggleFavorite(id) {
  const entry = state.vault.entries.find((item) => item.id === id);
  if (!entry) return;
  entry.favorite = !entry.favorite;
  await persistVault();
  renderEntries();
}

async function deleteEntry(entry) {
  if (!confirm(`¿Eliminar la contraseña de ${entry.site}? Esta acción no se puede deshacer.`)) return;
  state.vault.entries = state.vault.entries.filter((item) => item.id !== entry.id);
  await persistVault();
  renderEntries();
  showToast("Contraseña eliminada");
}

function unbiasedIndex(max) {
  const limit = Math.floor(256 / max) * max;
  const buffer = new Uint8Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= limit);
  return buffer[0] % max;
}

function secureShuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = unbiasedIndex(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function generatePassword() {
  const sets = [];
  if ($("#useUppercase").checked) sets.push("ABCDEFGHJKLMNPQRSTUVWXYZ");
  if ($("#useLowercase").checked) sets.push("abcdefghijkmnopqrstuvwxyz");
  if ($("#useNumbers").checked) sets.push("23456789");
  if ($("#useSymbols").checked) sets.push("!@#$%^&*()-_=+[]{};:,.?");
  if (!sets.length) {
    $("#useLowercase").checked = true;
    sets.push("abcdefghijkmnopqrstuvwxyz");
  }
  const length = Math.max(Number(elements.passwordLength.value), sets.length);
  const password = sets.map((set) => set[unbiasedIndex(set.length)]);
  const combined = sets.join("");
  while (password.length < length) password.push(combined[unbiasedIndex(combined.length)]);
  return secureShuffle(password).join("");
}

function strengthOf(password) {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^A-Za-z0-9]/.test(password)) pool += 28;
  const entropy = password.length * Math.log2(Math.max(pool, 1));
  if (entropy < 50) return { label: "Débil", width: 25, color: "#ff7b86" };
  if (entropy < 75) return { label: "Aceptable", width: 50, color: "#f2c86b" };
  if (entropy < 100) return { label: "Fuerte", width: 75, color: "#7de0d2" };
  return { label: "Muy fuerte", width: 100, color: "#7cf5bc" };
}

function updateStrength(password, fill, label) {
  const strength = strengthOf(password);
  fill.style.width = `${strength.width}%`;
  fill.style.background = strength.color;
  label.textContent = `${strength.label} · ${password.length} caracteres`;
}

function refreshGeneratedPassword() {
  const password = generatePassword();
  elements.generatedPassword.textContent = password;
  updateStrength(password, elements.generatorStrengthFill, elements.generatorStrengthLabel);
}

function openGenerator() {
  refreshGeneratedPassword();
  elements.generatorDialog.showModal();
}

async function copySecret(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast("Copiada. El portapapeles se limpiará en 30 segundos.");
    clearTimeout(state.clipboardTimer);
    state.clipboardTimer = setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === value) await navigator.clipboard.writeText("");
      } catch { /* El navegador puede impedir leer el portapapeles sin interacción. */ }
    }, 30000);
  } catch {
    showToast("No se pudo copiar. Revisa el permiso del portapapeles.");
  }
}

function exportVault() {
  const stored = getStoredVault();
  if (!stored) return;
  const blob = new Blob([JSON.stringify(stored, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `clavelocal-copia-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Copia cifrada exportada");
}

async function importVault(file) {
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (imported?.format !== "clavelocal-v1" || !imported?.kdf?.salt || !imported?.cipher?.iv || !imported?.cipher?.data) throw new Error();
    if (!confirm("Importar reemplazará la bóveda actual. ¿Deseas continuar?")) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
    lockVault("Copia importada. Ábrela con su clave maestra.");
  } catch {
    showToast("El archivo no es una copia válida de ClaveLocal");
  } finally {
    elements.importFile.value = "";
  }
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function bindEvents() {
  elements.authForm.addEventListener("submit", handleAuth);
  elements.lockButton.addEventListener("click", () => lockVault());
  $$("[data-reveal]").forEach((button) => button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.reveal);
    input.type = input.type === "password" ? "text" : "password";
  }));
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.view)));
  $("#newEntryButton").addEventListener("click", () => openEntryDialog());
  $("#emptyNewButton").addEventListener("click", () => openEntryDialog());
  elements.entryForm.addEventListener("submit", saveEntry);
  elements.entryPassword.addEventListener("input", () => updateStrength(elements.entryPassword.value, elements.entryStrengthFill, elements.entryStrengthLabel));
  elements.searchInput.addEventListener("input", renderEntries);
  $("#openGeneratorButton").addEventListener("click", openGenerator);
  $("#regenerateButton").addEventListener("click", refreshGeneratedPassword);
  $("#copyGeneratedButton").addEventListener("click", () => copySecret(elements.generatedPassword.textContent));
  $("#useGeneratedButton").addEventListener("click", (event) => {
    event.preventDefault();
    const password = elements.generatedPassword.textContent;
    elements.generatorDialog.close();
    openEntryDialog();
    elements.entryPassword.value = password;
    updateStrength(password, elements.entryStrengthFill, elements.entryStrengthLabel);
  });
  elements.passwordLength.addEventListener("input", () => { elements.lengthValue.textContent = elements.passwordLength.value; refreshGeneratedPassword(); });
  $$(".option-grid input").forEach((input) => input.addEventListener("change", refreshGeneratedPassword));
  $("#exportButton").addEventListener("click", exportVault);
  $("#importButton").addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", () => importVault(elements.importFile.files[0]));
  for (const name of ["pointerdown", "keydown"]) document.addEventListener(name, resetInactivityTimer, { passive: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden) resetInactivityTimer(); });
}

bindEvents();
configureAuth();
