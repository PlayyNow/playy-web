import type { PublicEventResponse } from '../types';
import { buildSandboxEvent } from './buildSandbox';

const CHANNEL = 'playy-sandbox-v1';
const STORAGE_KEY = 'playy-sandbox-v1';

export type SandboxEnvelope = {
  data: PublicEventResponse;
  fail: boolean;
  at: number;
};

let memory: SandboxEnvelope | null = null;

function persist(next: SandboxEnvelope): void {
  memory = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* The views still receive the channel message. */
  }
}

export function ensureEnvelope(courtCount: number): SandboxEnvelope {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SandboxEnvelope;
      if (parsed?.data?.event && parsed.data.americano) {
        memory = parsed;
        return parsed;
      }
    }
  } catch {
    /* Start a fresh setup board. */
  }
  const created: SandboxEnvelope = {
    data: buildSandboxEvent(courtCount, 'setup'),
    fail: false,
    at: Date.now(),
  };
  persist(created);
  return created;
}

export function publish(next: SandboxEnvelope): void {
  persist(next);
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage(next);
  channel.close();
}

export function subscribe(listener: (env: SandboxEnvelope) => void): () => void {
  let lastAt = memory?.at ?? 0;
  const deliver = (env: SandboxEnvelope) => {
    if (!env?.data?.event || env.at === lastAt) return;
    lastAt = env.at;
    memory = env;
    listener(env);
  };
  const channel = new BroadcastChannel(CHANNEL);
  const onMessage = (event: MessageEvent<SandboxEnvelope>) => {
    deliver(event.data);
  };
  channel.addEventListener('message', onMessage);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      deliver(JSON.parse(event.newValue) as SandboxEnvelope);
    } catch {
      /* Ignore a bad snapshot. */
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    channel.removeEventListener('message', onMessage);
    channel.close();
    window.removeEventListener('storage', onStorage);
  };
}

export function commitData(data: PublicEventResponse, courtCount: number): SandboxEnvelope {
  const current = memory ?? ensureEnvelope(courtCount);
  const next: SandboxEnvelope = { data, fail: current.fail, at: Date.now() };
  publish(next);
  return next;
}

export function commitFailure(fail: boolean, courtCount: number): SandboxEnvelope {
  const current = memory ?? ensureEnvelope(courtCount);
  const next: SandboxEnvelope = { ...current, fail, at: Date.now() };
  publish(next);
  return next;
}
