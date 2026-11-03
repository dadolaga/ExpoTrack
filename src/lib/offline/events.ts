export type LocalChangeKind = "local" | "remote";
const listeners = new Map<string, Set<(kind: LocalChangeKind) => void>>();
const source = Math.random().toString(36);

function inform(listener: (kind: LocalChangeKind) => void, kind: LocalChangeKind) {
  try {
    listener(kind);
  } catch {
    // An observer must never turn an already committed save into a reported failure.
    console.error("Impossibile aggiornare una vista locale.");
  }
}

function channelFor(name: string): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  try {
    return new BroadcastChannel(`expotrack:${name}`);
  } catch {
    // Cross-tab notifications are optional; server idempotency remains mandatory.
    return null;
  }
}

export function notifyLocalChange(name: string, kind: LocalChangeKind) {
  for (const listener of listeners.get(name) ?? []) {
    inform(listener, kind);
  }
  const channel = channelFor(name);

  try {
    channel?.postMessage({
      source,
      kind,
    });
  } catch {
    // A restricted browser may permit IndexedDB while blocking channel messages.
  } finally {
    channel?.close();
  }
}

export function subscribeLocalChanges(name: string, listener: (kind: LocalChangeKind) => void) {
  const group = listeners.get(name) ?? new Set();

  group.add(listener);
  listeners.set(name, group);
  const channel = channelFor(name);

  if (channel !== null) {
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;

      if (typeof data === "object" && data !== null && "source" in data && data.source !== source
        && "kind" in data && (data.kind === "local" || data.kind === "remote")) {
        inform(listener, data.kind);
      }
    };
  }

  return () => {
    group.delete(listener);
    channel?.close();
    if (group.size === 0) {
      listeners.delete(name);
    }
  };
}
