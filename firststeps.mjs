export const LOCK_REVIEWED_KEY = "clavelocal.first-steps.lock.v1";
export const HEALTH_REVIEWED_KEY = "clavelocal.first-steps.health.v1";
export const DISMISSED_KEY = "clavelocal.first-steps.dismissed.v1";

// Pure helper. It only receives counts and booleans, never entry contents.
// The backup prompt is not a step here: the existing export reminder already covers it.
export function firstSteps({ entryCount = 0, lockReviewed = false, healthReviewed = false } = {}) {
  const steps = [
    { id: "entry", title: "Guarda tu primera contraseña", hint: "Crea una entrada o usa el generador.", action: "Crear contraseña", done: entryCount > 0 },
    { id: "lock", title: "Revisa el bloqueo automático", hint: "Por defecto se bloquea tras 5 minutos sin actividad.", action: "Revisar bloqueo", done: Boolean(lockReviewed) },
    { id: "health", title: "Mira la salud de tu bóveda", hint: "Detecta claves repetidas o débiles sin salir de este equipo.", action: "Abrir salud", done: Boolean(healthReviewed) },
  ];
  const done = steps.filter((step) => step.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
}
