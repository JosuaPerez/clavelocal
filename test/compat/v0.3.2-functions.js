// Frozen original functions from da930d1203cead91a4569d8f6e6fca338eb81ec9; never regenerate during tests.
function validateVault(value) {
  if (value?.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 5000) throw new Error("Bóveda no válida");
  if (value.profile !== undefined) validateProfile(value.profile);
  const ids = new Set();
  for (const entry of value.entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id) || typeof entry.favorite !== "boolean") throw new Error("Entrada no válida");
    for (const [field, max] of Object.entries({ id: 100, site: 80, username: 120, category: 40, password: 4096, notes: 500, updatedAt: 40 })) {
      if (typeof entry[field] !== "string" || entry[field].length > max) throw new Error("Campo no válido");
    }
    if (!entry.site || !entry.password || !["Personal", "Trabajo", "Finanzas", "Redes", "Otros"].includes(entry.category)) throw new Error("Entrada incompleta");
    ids.add(entry.id);
  }
  return value;
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
    state.page = 1;
    renderEntries();
    showToast(`${count} contraseñas importadas y cifradas. Verifica tus entradas y exporta una copia cifrada.`);
  } catch (error) { $("#csvError").textContent = error.message; $("#confirmCsv").disabled = false; }
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
