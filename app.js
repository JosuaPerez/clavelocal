"use strict";

import { STORAGE_KEY, MAX_FILE_BYTES, VaultStore, randomBytes, deriveKey, encryptVault, openVault, validateEnvelope } from "./vault.mjs";
import { parseCsv, planCsvImport } from "./csv.mjs";
import { PROFILE_KEY, normalizeUsername, readCachedProfile, cacheProfile } from "./profile.mjs";
const INACTIVITY_MS = 5 * 60 * 1000;
const store = new VaultStore(localStorage);
let pendingImport = null;
let busy = false;
let session = 0;
let pendingCsv = null;
let csvPlan = null;
let updateInProgress = false;

const state = {
  key: null,
  vault: { version: 1, entries: [] },
  filter: "all",
  inactivityTimer: null,
  clipboardTimer: null,
  salt: null,
  demo: false,
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

function getStoredVault() {
  return store.read();
}

async function withStorageLock(operation) {
  if (!navigator.locks) throw new Error("Este navegador no permite guardar de forma segura. Utiliza una versión actual de Edge, Chrome o Firefox.");
  return navigator.locks.request(STORAGE_KEY, operation);
}

async function persistVault(next) {
  if (!state.key || busy) throw new Error("Hay otra operación en curso o la bóveda está bloqueada.");
  busy = true;
  const generation = session;
  try {
    const encrypted = await encryptVault(state.key, next, state.salt);
    await withStorageLock(() => {
      if (generation !== session || !state.key) throw new Error("La bóveda se bloqueó antes de guardar. Vuelve a abrirla.");
      store.commit(encrypted);
    });
    state.vault = next;
  } finally { busy = false; }
}

function configureAuth() {
  let exists;
  try { exists = Boolean(getStoredVault()); }
  catch {
    elements.authError.textContent = "No se puede leer la bóveda. Conservamos los datos: restaura una copia válida o revisa el almacenamiento del navegador.";
    elements.authSubmit.disabled = true;
    return;
  }
  elements.authSubmit.disabled = false;
  const profile = exists ? readCachedProfile(localStorage) : null;
  $("#authUsernameGroup").hidden = exists;
  $("#authUsername").required = !exists;
  $("#profileAvatar").hidden = !profile;
  $("#profileAvatar").textContent = profile ? Array.from(profile.username).slice(0, 2).join("").toLocaleUpperCase("es") : "";
  $("#authLockIcon").hidden = Boolean(profile);
  elements.confirmGroup.classList.toggle("hidden", exists);
  elements.confirmPassword.required = !exists;
  elements.masterPassword.autocomplete = exists ? "current-password" : "new-password";
  elements.authKicker.textContent = exists ? "BIENVENIDO DE NUEVO" : "PRIMER ACCESO";
  elements.authTitle.textContent = exists ? (profile ? `Hola, ${profile.username}` : "Abre tu bóveda") : "Crea tu perfil";
  elements.authDescription.textContent = exists
    ? "Introduce tu clave maestra para descifrar tus contraseñas."
    : "Elige tu usuario y una clave maestra para crear tu bóveda local.";
  elements.authSubmit.firstChild.textContent = exists ? "Entrar a mi bóveda " : "Crear perfil y bóveda ";
}

async function handleAuth(event) {
  event.preventDefault();
  elements.authError.textContent = "";
  const password = elements.masterPassword.value;
  if (busy) return;

  if (password.length < 12) {
    elements.authError.textContent = "Usa al menos 12 caracteres para tu clave maestra.";
    return;
  }
  if (!$("#authUsernameGroup").hidden) {
    try { normalizeUsername($("#authUsername").value); }
    catch (error) { elements.authError.textContent = error.message; return; }
    if (password !== elements.confirmPassword.value) { elements.authError.textContent = "Las claves no coinciden."; return; }
  }
  busy = true;
  const generation = ++session;
  elements.authSubmit.disabled = true;
  try {
    await withStorageLock(async () => {
      const stored = getStoredVault();
      if (!stored && password !== elements.confirmPassword.value) throw new Error("Las claves no coinciden.");
      const opened = stored ? await openVault(password, stored) : { vault: { version: 1, entries: [], profile: { version: 1, username: normalizeUsername($("#authUsername").value) } } };
      const salt = randomBytes(16);
      const key = await deriveKey(password, salt);
      const encrypted = await encryptVault(key, opened.vault, salt);
      if (generation !== session) throw new Error("Operación cancelada");
      // Old KDF parameters are migrated only after successful authentication.
      store.commit(encrypted);
      state.key = key;
      state.salt = salt;
      state.vault = opened.vault;
    });
    elements.authForm.reset();
    unlockUi();
  } catch {
    state.key = null;
    elements.authError.textContent = "No se pudo abrir o guardar la bóveda. Revisa la clave, la copia y el espacio disponible. Los datos anteriores se conservan.";
  } finally {
    busy = false;
    elements.authSubmit.disabled = false;
  }
  if (state.key && !state.vault.profile) showProfileDialog();
}

function unlockUi() {
  elements.welcomeView.classList.add("hidden");
  elements.vaultView.classList.remove("hidden");
  elements.lockButton.classList.remove("hidden");
  state.filter = "all";
  elements.searchInput.value = "";
  renderProfile();
  renderEntries();
  resetInactivityTimer();
}

function lockVault(message = "Bóveda bloqueada") {
  session += 1;
  state.key = null;
  state.salt = null;
  state.vault = { version: 1, entries: [] };
  clearTimeout(state.inactivityTimer);
  clearTimeout(state.clipboardTimer);
  elements.entryForm.reset();
  elements.authForm.reset();
  $("#profileForm").reset();
  $("#profileDialog").close();
  $("#vaultGreeting").textContent = "TU ESPACIO PRIVADO";
  $("#importForm").reset();
  pendingImport = null;
  clearCsv();
  $("#csvDialog").close();
  $("#importDialog").close();
  for (const id of ["masterPassword", "confirmPassword", "entryPassword"]) document.getElementById(id).type = "password";
  elements.generatedPassword.textContent = "";
  elements.entryList.replaceChildren();
  elements.categoryNav.replaceChildren();
  elements.searchInput.value = "";
  elements.allCount.textContent = "0";
  elements.favoriteCount.textContent = "0";
  elements.entryDialog.close();
  elements.generatorDialog.close();
  elements.vaultView.classList.add("hidden");
  elements.lockButton.classList.add("hidden");
  elements.welcomeView.classList.remove("hidden");
  if (state.demo) {
    state.demo = false;
    $(".privacy-pill").textContent = "Solo en este PC";
  }
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
  if (event.submitter?.value === "cancel") { elements.entryForm.reset(); elements.entryDialog.close(); return; }
  if (state.demo) { showToast("La demo usa solo datos ficticios. Descarga la app para crear tu bóveda."); return; }
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
  const next = structuredClone(state.vault);
  if (existing) Object.assign(next.entries.find((item) => item.id === id), entry);
  else next.entries.push(entry);
  try { await persistVault(next); }
  catch (error) { elements.entryError.textContent = error.message; return; }
  elements.entryDialog.close();
  elements.entryForm.reset();
  renderEntries();
  showToast(existing ? "Contraseña actualizada" : "Contraseña guardada");
}

async function toggleFavorite(id) {
  if (state.demo) { showToast("Demo: los cambios no se guardan."); return; }
  const next = structuredClone(state.vault);
  const entry = next.entries.find((item) => item.id === id);
  if (!entry) return;
  entry.favorite = !entry.favorite;
  try { await persistVault(next); } catch (error) { showToast(error.message); return; }
  renderEntries();
}

async function deleteEntry(entry) {
  if (state.demo) return;
  if (!confirm(`¿Eliminar la contraseña de ${entry.site}? Esta acción no se puede deshacer.`)) return;
  const next = { ...state.vault, entries: state.vault.entries.filter((item) => item.id !== entry.id) };
  try { await persistVault(next); } catch (error) { showToast(error.message); return; }
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
  label.textContent = `Estimación por longitud y variedad · ${password.length} caracteres. No detecta frases predecibles.`;
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
    showToast("Copiada. Intentaremos limpiarla en 30 segundos; el navegador puede impedirlo.");
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
  if (state.demo) { showToast("La demo no contiene una bóveda para exportar."); return; }
  let stored;
  try { stored = validateEnvelope(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { showToast("No se pudo leer la copia cifrada."); return; }
  if (!stored) return;
  downloadEnvelope(stored);
}

function downloadEnvelope(stored, suffix = "copia") {
  const blob = new Blob([JSON.stringify(stored, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `clavelocal-${suffix}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Copia cifrada exportada");
}

async function importVault(file) {
  if (!file) return;
  if (state.demo || busy) return;
  try {
    if (/\.csv$/i.test(file.name)) {
      if (!state.key) throw new Error("Abre o crea tu bóveda antes de importar un CSV.");
      const generation = session;
      if (file.size > MAX_FILE_BYTES) throw new Error("El CSV supera 4 MiB.");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      if (generation !== session || !state.key) return;
      pendingCsv = parseCsv(text);
      renderCsvMapping();
      $("#csvDialog").showModal();
      return;
    }
    if (file.size > MAX_FILE_BYTES) throw new Error();
    pendingImport = validateEnvelope(JSON.parse(await file.text()));
    $("#importForm").reset();
    $("#importError").textContent = "";
    $("#importDialog").showModal();
    $("#importPassword").focus();
  } catch (error) {
    showToast(/\.csv$/i.test(file.name) ? error.message : "El archivo no es una copia válida de ClaveLocal");
  } finally {
    elements.importFile.value = "";
  }
}

function clearCsv() {
  pendingCsv = null; csvPlan = null;
  $("#csvForm").reset();
  $("#csvMapping").replaceChildren();
  $("#csvIssues").replaceChildren();
  $("#csvSummary").textContent = "";
  $("#csvError").textContent = "";
}

function renderCsvMapping() {
  $("#csvForm").reset();
  $("#csvMapping").replaceChildren();
  for (const [field, labelText] of Object.entries({ site: "Nombre o sitio", url: "URL", username: "Usuario", password: "Contraseña", notes: "Notas" })) {
    const container = document.createElement("div");
    const label = document.createElement("label");
    label.htmlFor = `csv-${field}`; label.textContent = labelText;
    const select = document.createElement("select");
    select.id = `csv-${field}`; select.dataset.field = field;
    select.add(new Option("No importar", "-1"));
    pendingCsv.headers.forEach((header, index) => select.add(new Option(`${index + 1}: ${header.slice(0, 80)}`, String(index))));
    select.value = String(pendingCsv.mapping[field]);
    select.addEventListener("change", updateCsvPlan);
    container.append(label, select); $("#csvMapping").append(container);
  }
  updateCsvPlan();
}

function updateCsvPlan() {
  csvPlan = null;
  $("#csvAcknowledge").checked = false;
  $("#csvError").textContent = "";
  $("#csvIssues").replaceChildren();
  $("#confirmCsv").disabled = true;
  try {
    if (!pendingCsv || !state.key || state.demo) throw new Error("Abre una bóveda para importar.");
    const mapping = Object.fromEntries($$("#csvMapping select").map((select) => [select.dataset.field, Number(select.value)]));
    csvPlan = planCsvImport(pendingCsv, mapping, state.vault);
    $("#csvSummary").textContent = `${csvPlan.total} registros: ${csvPlan.entries.length} nuevos, ${csvPlan.duplicates} duplicados exactos y ${csvPlan.issues.length} no válidos. Las entradas existentes se conservarán.`;
    for (const issue of csvPlan.issues.slice(0, 20)) {
      const item = document.createElement("li"); item.textContent = `Registro ${issue.row}: ${issue.reason}.`; $("#csvIssues").append(item);
    }
    $("#confirmCsv").disabled = csvPlan.entries.length === 0;
  } catch (error) { $("#csvError").textContent = error.message; $("#csvSummary").textContent = "No se ha guardado ningún cambio."; }
}

async function confirmCsv(event) {
  event.preventDefault();
  if (!state.key || state.demo || busy || !csvPlan?.entries.length || !$("#csvAcknowledge").checked) return;
  const count = csvPlan.entries.length;
  const next = { ...state.vault, entries: [...state.vault.entries, ...csvPlan.entries] };
  $("#confirmCsv").disabled = true;
  try {
    await persistVault(next);
    $("#csvDialog").close();
    clearCsv();
    renderEntries();
    showToast(`${count} contraseñas importadas y cifradas. Verifica tus entradas y exporta una copia cifrada.`);
  } catch (error) { $("#csvError").textContent = error.message; $("#confirmCsv").disabled = false; }
}

async function confirmImport(event) {
  event.preventDefault();
  if (busy || !pendingImport) return;
  busy = true;
  const generation = session;
  const imported = pendingImport;
  try {
    const password = $("#importPassword").value;
    const opened = await openVault(password, imported);
    const salt = randomBytes(16);
    const key = await deriveKey(password, salt);
    const migrated = await encryptVault(key, opened.vault, salt);
    if (session !== generation || pendingImport !== imported) return;
    if (!confirm(`Copia verificada: ${opened.vault.entries.length} entradas. ¿Reemplazar la bóveda? Conservaremos una copia cifrada anterior cuando exista.`)) return;
    await withStorageLock(() => {
      if (session !== generation) throw new Error("Operación cancelada");
      store.commit(migrated);
    });
    cacheProfile(localStorage, opened.vault.profile);
    lockVault("Copia verificada y restaurada. Abre tu bóveda.");
  } catch {
    $("#importError").textContent = "No se pudo verificar o guardar la copia. Revisa su clave y el espacio disponible. La bóveda actual no fue reemplazada.";
  } finally { busy = false; $("#importPassword").value = ""; }
}

function renderProfile() {
  const profile = state.vault.profile;
  $("#vaultGreeting").textContent = state.demo ? "DEMO · DATOS FICTICIOS" : profile ? `Hola, ${profile.username}` : "TU ESPACIO PRIVADO";
  $("#profileButton").disabled = state.demo;
  if (!state.demo && !cacheProfile(localStorage, profile)) showToast("La bóveda está abierta, pero no pudimos recordar tu nombre en este equipo.");
}

function showProfileDialog() {
  if (!state.key || state.demo || busy) return;
  $("#profileForm").reset();
  $("#profileUsername").value = state.vault.profile?.username || "";
  $("#profileError").textContent = "";
  $("#profileDescription").textContent = state.vault.profile ? "Puedes cambiar el nombre de tu perfil local. Tu clave maestra y tus contraseñas se conservan." : "Tu bóveda ya está abierta. Elige cómo quieres que te saludemos; tus contraseñas actuales se conservan.";
  $("#profileDialog").showModal();
  $("#profileUsername").focus();
}

async function saveProfile(event) {
  event.preventDefault();
  if (!state.key || state.demo || busy) return;
  try {
    const profile = { version: 1, username: normalizeUsername($("#profileUsername").value) };
    await persistVault({ ...state.vault, profile });
    renderProfile();
    $("#profileDialog").close();
    $("#profileForm").reset();
    showToast("Perfil guardado. La próxima vez solo necesitarás tu clave maestra.");
  } catch (error) { $("#profileError").textContent = error.message; }
}

function startDemo() {
  if (busy) return;
  state.demo = true;
  state.vault = { version: 1, entries: [
    { id: "demo-1", site: "Correo de ejemplo", username: "ana@example.invalid", category: "Personal", password: "Ejemplo-No-Es-Un-Secreto-123!", notes: "Datos ficticios", favorite: true, updatedAt: new Date().toISOString() },
    { id: "demo-2", site: "Trabajo de ejemplo", username: "demo@example.invalid", category: "Trabajo", password: "Solo-Para-Probar-456!", notes: "Datos ficticios", favorite: false, updatedAt: new Date().toISOString() },
  ] };
  $(".privacy-pill").textContent = "DEMO · Solo datos ficticios";
  unlockUi();
  showToast("Demo de lectura: no introduzcas contraseñas reales.");
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function bindEvents() {
  $("#profileButton").addEventListener("click", showProfileDialog);
  $("#profileForm").addEventListener("submit", saveProfile);
  $("#cancelProfile").addEventListener("click", () => $("#profileDialog").close());
  $("#profileDialog").addEventListener("close", () => $("#profileForm").reset());
  setupUpdater();
  $("#csvImportButton").addEventListener("click", () => { elements.importFile.accept = ".csv,text/csv"; elements.importFile.click(); });
  $("#csvForm").addEventListener("submit", confirmCsv);
  $("#csvDialog").addEventListener("close", clearCsv);
  $("#cancelCsv").addEventListener("click", () => { $("#csvDialog").close(); clearCsv(); });
  $("#previousBackupButton").addEventListener("click", () => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}.previous`);
      if (!raw) { showToast("Todavía no existe una copia anterior."); return; }
      downloadEnvelope(validateEnvelope(JSON.parse(raw)), "anterior");
    } catch { showToast("No se puede leer la copia anterior."); }
  });
  $("#demoButton").addEventListener("click", startDemo);
  $("#restoreButton").addEventListener("click", () => { elements.importFile.accept = ".json,application/json"; elements.importFile.click(); });
  $("#importForm").addEventListener("submit", confirmImport);
  $("#cancelImport").addEventListener("click", () => { pendingImport = null; $("#importForm").reset(); $("#importDialog").close(); });
  $("#importDialog").addEventListener("close", () => { pendingImport = null; $("#importForm").reset(); });
  elements.entryDialog.addEventListener("close", () => elements.entryForm.reset());
  elements.generatorDialog.addEventListener("close", () => { elements.generatedPassword.textContent = ""; });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) lockVault("La bóveda cambió en otra ventana. Vuelve a abrirla.");
    else if (event.key === PROFILE_KEY && !state.key && !state.demo) configureAuth();
  });
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
  $("#importButton").addEventListener("click", () => { elements.importFile.accept = ".json,application/json"; elements.importFile.click(); });
  elements.importFile.addEventListener("change", () => importVault(elements.importFile.files[0]));
  for (const name of ["pointerdown", "keydown"]) document.addEventListener(name, resetInactivityTimer, { passive: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden && (state.key || state.demo)) lockVault("Bóveda bloqueada al salir de la ventana"); });
}

function setupUpdater() {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke || document.documentElement.dataset.mode === "demo") return;
  $("#checkUpdatesButton").hidden = false;
  $("#checkUpdatesButton").addEventListener("click", async () => {
    if (busy || updateInProgress) { showToast("Termina la operación actual antes de buscar actualizaciones."); return; }
    updateInProgress = true;
    $("#updateBackupAck").checked = false;
    $("#installUpdateButton").hidden = true;
    $("#updateNotes").textContent = "";
    $("#updateStatus").textContent = "Buscando una versión publicada…";
    $("#updateDialog").showModal();
    try {
      const update = await invoke("check_update");
      $("#updateStatus").textContent = update ? `Nueva versión disponible: ${update.version}` : "Tienes la versión más reciente publicada en este canal.";
      $("#updateNotes").textContent = update?.notes || "";
      $("#installUpdateButton").hidden = !update;
    } catch (error) { $("#updateStatus").textContent = String(error); }
    finally { updateInProgress = false; }
  });
  $("#installUpdateButton").addEventListener("click", async () => {
    if (busy || updateInProgress) return;
    if (!$("#updateBackupAck").checked) { $("#updateStatus").textContent = "Exporta una copia cifrada y marca la confirmación antes de actualizar."; return; }
    if (!confirm("¿Descargar la versión firmada, cerrar ClaveLocal e instalarla? La bóveda se conservará en este usuario de Windows.")) return;
    updateInProgress = true;
    lockVault("Bóveda bloqueada para actualizar");
    $("#installUpdateButton").disabled = true;
    $("#updateStatus").textContent = "Descargando y verificando la firma…";
    try { await invoke("install_update"); }
    catch (error) { $("#updateStatus").textContent = String(error); }
    finally { updateInProgress = false; $("#installUpdateButton").disabled = false; }
  });
}

bindEvents();
configureAuth();
// The hosted demo is a separate build: no real vault entry or import is offered.
if (document.documentElement.dataset.mode === "demo") {
  elements.authForm.hidden = true;
  $("#restoreButton").hidden = true;
  $("#previousBackupButton").hidden = true;
  $("#authDescription").textContent = "Explora ClaveLocal con datos ficticios. Para guardar contraseñas, descarga la aplicación de Windows.";
  $("#authTitle").textContent = "Prueba ClaveLocal";
  elements.entryForm.querySelectorAll("input, textarea, select").forEach((input) => { input.disabled = true; });
  $("#newEntryButton").disabled = true;
  $("#emptyNewButton").disabled = true;
  $("#saveEntryButton").disabled = true;
  $("#importButton").disabled = true;
  $("#csvImportButton").disabled = true;
  $("#exportButton").disabled = true;
  $("#useGeneratedButton").disabled = true;
}
