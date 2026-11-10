export const DEFAULT_SETTINGS = Object.freeze({ idleMinutes: 5, hiddenSeconds: 0 });

export function validateSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== 2
    || !Object.hasOwn(value, "idleMinutes") || !Object.hasOwn(value, "hiddenSeconds")
    || ![1, 5, 15, 30].includes(value.idleMinutes) || ![0, 15, 60].includes(value.hiddenSeconds)) {
    throw new Error("Ajustes de bloqueo no válidos");
  }
  return value;
}

export function createLockPolicy({ lock, schedule = setTimeout, cancel = clearTimeout }) {
  let settings = DEFAULT_SETTINGS;
  let active = false, hidden = false;
  let idleTimer, hiddenTimer;
  let idleGeneration = 0, hiddenGeneration = 0;
  function stop() {
    active = false;
    cancel(idleTimer); cancel(hiddenTimer);
    idleGeneration++; hiddenGeneration++;
    settings = DEFAULT_SETTINGS;
  }
  function activity() {
    if (!active || hidden) return;
    cancel(idleTimer);
    const generation = ++idleGeneration;
    idleTimer = schedule(() => {
      if (active && generation === idleGeneration) lock("Bóveda bloqueada por inactividad");
    }, settings.idleMinutes * 60000);
  }
  function visibility(isHidden) {
    // Repeated hidden notifications must not extend the grace period.
    if (!active || hidden === isHidden) return;
    hidden = isHidden;
    cancel(hiddenTimer);
    const generation = ++hiddenGeneration;
    if (!hidden) return;
    if (settings.hiddenSeconds === 0) { lock("Bóveda bloqueada al salir de la ventana"); return; }
    hiddenTimer = schedule(() => {
      if (active && hidden && generation === hiddenGeneration) lock("Bóveda bloqueada al salir de la ventana");
    }, settings.hiddenSeconds * 1000);
  }
  return {
    start(value = DEFAULT_SETTINGS, isHidden = false) {
      validateSettings(value);
      stop(); settings = { ...value }; active = true; hidden = false;
      activity(); visibility(isHidden);
    },
    activity, visibility, stop,
  };
}
