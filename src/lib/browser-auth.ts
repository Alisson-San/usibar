"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_ID, SUPABASE_DEFAULTS } from "./supabase-config.mjs";

// Browser side of Supabase Auth. The client (~45 KB) is loaded on demand, so ordinary
// visitors never download it.
export const SUPABASE = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_DEFAULTS.url,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || SUPABASE_DEFAULTS.key,
};

let client: Promise<SupabaseClient> | null = null;
export function supabase() {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE.url, SUPABASE.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  );
  return client;
}

// Cheap check (no network, no library) that a session may exist in this browser.
export function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
    }
  } catch {}
  return false;
}

// Does the signed-in account administer this site? The database answers.
export async function isAdmin(db?: SupabaseClient) {
  db ??= await supabase();
  const { data } = await db.auth.getSession();
  if (!data.session) return false;
  const { data: ok, error } = await db.rpc("is_site_admin", { p_site: SITE_ID });
  return !error && ok === true;
}

export async function accessToken() {
  const { data } = await (await supabase()).auth.getSession();
  return data.session?.access_token ?? null;
}

// fetch() to our own API, with the admin's token when there is one (Supabase mode).
export async function authFetch(input: string, init: RequestInit = {}) {
  const token = hasStoredSession() ? await accessToken().catch(() => null) : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function signOut() {
  if (hasStoredSession()) await (await supabase()).auth.signOut().catch(() => {});
}

export type AdminRow = { email: string; created_at: string; has_account: boolean };

// Admin management goes through the "site-admins" Edge Function, which checks the caller.
export async function adminCall<T = Record<string, unknown>>(
  action: "list" | "add" | "remove",
  extra: { email?: string; password?: string } = {},
): Promise<T> {
  const token = await accessToken();
  if (!token) throw Error("Sessão expirada. Entre novamente.");
  const res = await fetch(`${SUPABASE.url}/functions/v1/site-admins`, {
    method: "POST",
    headers: {
      apikey: SUPABASE.key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, site: SITE_ID, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(body.error || "Não foi possível concluir a operação.");
  return body as T;
}

export async function changeMyPassword(password: string) {
  const { error } = await (await supabase()).auth.updateUser({ password });
  if (error) throw Error(error.message);
}
