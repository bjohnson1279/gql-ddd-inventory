import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";

const storage = new AsyncLocalStorage<Map<string, string>>();

export function runWithTrace<T>(traceId: string, fn: () => T): T {
  const store = new Map<string, string>();
  store.set("traceId", traceId);
  return storage.run(store, fn);
}

export function getTraceId(): string {
  const store = storage.getStore();
  return store?.get("traceId") || "";
}

export function generateTraceId(): string {
  return crypto.randomUUID();
}
