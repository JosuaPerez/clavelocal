// Browser cleanup is best effort. Timers retain a digest, never the copied text.
export function createClipboardCleaner({ clipboard, digest = async (text) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}, now = Date.now, schedule = setTimeout, cancel = clearTimeout, onBlocked = () => {} }) {
  let pending = null;
  let timer = null;
  let queue = Promise.resolve();
  // Serialize our own copies and wipes. Browser clipboard read/clear is not atomic
  // with copies from other apps; native Windows uses a single OpenClipboard lock.
  function serialize(operation) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }
  async function wipe() {
    if (!pending || now() < pending.deadline) return "waiting";
    try {
      const hash = await digest(await clipboard.readText());
      if (hash === pending.hash) await clipboard.writeText("");
      pending = null;
      return "done";
    } catch {
      onBlocked();
      return "blocked"; // Keep only the digest and deadline for a foreground retry.
    }
  }
  return {
    copySecret(value) {
      return serialize(async () => {
        const hash = await digest(value);
        await clipboard.writeText(value);
        cancel(timer);
        pending = { hash, deadline: now() + 30000 };
        timer = schedule(() => { void serialize(wipe); }, 30000);
      });
    },
    wipeIfUnchanged() { return serialize(wipe); },
  };
}
