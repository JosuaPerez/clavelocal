import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, validateSettings, createLockPolicy } from "../settings.mjs";
import { validateVault, deriveKey, encryptVault, openVault, randomBytes } from "../vault.mjs";

function setup(settings) {
  let time = 0, nextId = 0;
  const jobs = new Map(), locked = [];
  const policy = createLockPolicy({
    lock: (message) => { locked.push(message); policy.stop(); },
    schedule: (callback, delay) => { jobs.set(++nextId, { callback, at: time + delay }); return nextId; },
    cancel: (id) => jobs.delete(id),
  });
  policy.start(settings);
  return { policy, jobs, locked, tick(ms) {
    const end = time + ms;
    while (true) {
      const job = [...jobs.entries()].sort((a,b) => a[1].at - b[1].at)[0];
      if (!job || job[1].at > end) break;
      time = job[1].at; jobs.delete(job[0]); job[1].callback();
    }
    time = end;
  } };
}

test("valores estrictos y bóvedas sin ajustes conservan el formato v1", async () => {
  for (const idleMinutes of [1, 5, 15, 30]) for (const hiddenSeconds of [0, 15, 60]) {
    assert.deepEqual(validateSettings({ idleMinutes, hiddenSeconds }), { idleMinutes, hiddenSeconds });
  }
  for (const value of [null, [], {}, { idleMinutes: "5", hiddenSeconds: 0 }, { idleMinutes: 5, hiddenSeconds: 1 },
    { idleMinutes: 2, hiddenSeconds: 0 }, { ...DEFAULT_SETTINGS, extra: true }]) {
    assert.throws(() => validateSettings(value), /no válidos/);
    assert.throws(() => validateVault({ version: 1, entries: [], settings: value }), /no válidos/);
  }
  assert.deepEqual(validateVault({ version: 1, entries: [] }), { version: 1, entries: [] });
  const salt = randomBytes(16), password = "ficticia-ajustes-no-real";
  const key = await deriveKey(password, salt);
  const vault = { version: 1, entries: [], settings: { idleMinutes: 15, hiddenSeconds: 60 } };
  const envelope = await encryptVault(key, vault, salt);
  assert.equal(JSON.stringify(envelope).includes("hiddenSeconds"), false);
  assert.deepEqual((await openVault(password, envelope)).vault, vault);
});

test("por defecto bloquea inmediatamente al ocultar y a 5 minutos de inactividad", () => {
  const t = setup();
  t.policy.visibility(true);
  assert.equal(t.locked.length, 1);
  const idle = setup();
  idle.tick(299999); assert.equal(idle.locked.length, 0);
  idle.tick(1); assert.match(idle.locked[0], /inactividad/);
});
for (const seconds of [15, 60]) {
  test(`gracia de ${seconds}s: volver cancela; ocultar repetidamente y actividad oculta no la extienden`, () => {
    const t = setup({ idleMinutes: 5, hiddenSeconds: seconds });
    t.policy.visibility(true);
    t.tick(seconds * 1000 - 1);
    assert.equal(t.locked.length, 0);
    t.policy.visibility(false);
    t.tick(1); assert.equal(t.locked.length, 0);
    t.policy.visibility(true);
    t.tick(1000);
    t.policy.visibility(true); t.policy.activity();
    t.tick(seconds * 1000 - 1000);
    assert.equal(t.locked.length, 1);
  });
}
test("inactividad prevalece sobre gracia; parar descarta callbacks viejos", () => {
  const t = setup({ idleMinutes: 1, hiddenSeconds: 60 });
  t.tick(59000); t.policy.visibility(true); t.tick(1000);
  assert.match(t.locked[0], /inactividad/);
  const next = setup();
  const obsolete = [...next.jobs.values()][0].callback;
  next.policy.stop(); next.policy.start({ idleMinutes: 30, hiddenSeconds: 60 });
  obsolete(); next.tick(300000);
  assert.equal(next.locked.length, 0);
});
test("todos los plazos de inactividad y actividad que los reinicia", () => {
  for (const idleMinutes of [1, 5, 15, 30]) {
    const t = setup({ idleMinutes, hiddenSeconds: 0 });
    t.tick(idleMinutes * 60000 - 1); t.policy.activity(); t.tick(idleMinutes * 60000 - 1);
    assert.equal(t.locked.length, 0); t.tick(1); assert.equal(t.locked.length, 1);
  }
});
