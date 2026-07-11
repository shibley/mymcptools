// Self-serve API key store (PRD P2-1 — Paid DaaS tier).
//
// Keys purchased via the /developers self-serve checkout are generated and
// activated automatically by the Stripe webhook, backed by a private Vercel
// Blob JSON file (api-keys.json in the mymcptools-keystore store) — no
// separate database needed, and no human has to hand-edit + redeploy to
// activate a paying customer's key. `src/data/api-keys.json` remains as the
// pre-Blob seed (hand-issued keys committed before this store existed); it's
// merged in as a fallback so nothing already granted stops working.

import { get, put } from "@vercel/blob";
import seedKeys from "@/data/api-keys.json";

export interface ApiKeyRecord {
  key: string;
  email: string;
  plan: string;
  created_at: string;
  status: "active" | "revoked";
}

interface KeyStore {
  keys: ApiKeyRecord[];
}

const BLOB_PATHNAME = "api-keys.json";
const seed = seedKeys as KeyStore;

async function readStore(): Promise<KeyStore> {
  try {
    const result = await get(BLOB_PATHNAME, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return seed;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as KeyStore;
    if (!Array.isArray(parsed.keys)) return seed;
    return parsed;
  } catch (err) {
    console.error("key-store: readStore failed, falling back to seed file:", err);
    return seed;
  }
}

async function writeStore(store: KeyStore): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(store, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Append a newly-purchased key and persist it immediately (no redeploy needed). */
export async function addApiKey(record: ApiKeyRecord): Promise<void> {
  const store = await readStore();
  store.keys.push(record);
  await writeStore(store);
}

/** True if `key` is a live, active self-serve key. */
export async function isActiveStoredKey(key: string): Promise<boolean> {
  const store = await readStore();
  return store.keys.some((k) => k.key === key && k.status === "active");
}

/** All key records currently in the store (do not mutate). */
export async function allStoredKeys(): Promise<readonly ApiKeyRecord[]> {
  const store = await readStore();
  return store.keys;
}
