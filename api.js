/* ----------------------------------------------------------------------
   BACKEND / DATA LAYER
   ------------------------------------------------------------------
   Every piece of persistence logic for the Period Tracker lives here.
   The UI layer (PeriodTracker.jsx) never talks to Supabase or to
   window.storage directly — it only calls the functions exported from
   this file. That keeps the "backend" swappable: point it at a
   different provider later and nothing in the UI has to change.

   Two storage modes, chosen automatically:
     1. Supabase (cloud-synced)   — used when SUPABASE_URL / ANON_KEY
        below are filled in.
     2. Local, on-device storage  — the fallback whenever Supabase
        isn't configured, using the host app's window.storage API.
------------------------------------------------------------------------ */

export const STORAGE_KEY = "period-tracker-data";
const SESSION_KEY = "supabase-session";

/* ----------------------------------------------------------------------
   SUPABASE PROJECT CONFIG
   Both values are safe to expose client-side — Row Level Security in
   your database (see schema.sql) is what actually keeps each user's
   data private, not secrecy of these values. Leave either blank and
   the app falls back to local, on-device-only storage.
------------------------------------------------------------------------ */
export const SUPABASE_URL = "https://ayjbzwtojmtwdvxpruzo.supabase.co"; // e.g. "https://xxxxxxxx.supabase.co"
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amJ6d3Rvam10d2R2eHBydXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Njg5NzksImV4cCI6MjEwMjQ0NDk3OX0.Fc2vr41xbOKKPIP8obAMP7ZiUdZGWUJjjd9Qvp2ej0M"; // Project Settings → API → anon public key
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* ----------------------------------------------------------------------
   ANONYMOUS AUTH SESSION
   Each device gets one anonymous Supabase auth user on first run, so
   Row Level Security has a stable `user_id` to key everything off of.
   The session is cached in window.storage so we don't sign up again
   on every page load.

   Requires "Anonymous Sign-ins" to be turned on in your Supabase
   project: Authentication → Providers → Anonymous Sign-Ins → Enable.
------------------------------------------------------------------------ */
async function getLocalSession() {
  try {
    const res = await window.storage.get(SESSION_KEY, false);
    return res ? JSON.parse(res.value) : null;
  } catch {
    return null;
  }
}

async function saveLocalSession(session) {
  try { await window.storage.set(SESSION_KEY, JSON.stringify(session), false); } catch {}
}

/** Ensures this device has an anonymous Supabase auth session, creating
 *  one on first run and reusing it (via window.storage) after that. */
async function ensureSupabaseSession() {
  if (!SUPABASE_CONFIGURED) return null;
  const existing = await getLocalSession();
  if (existing?.access_token && existing?.user_id) return existing;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const json = await res.json();
  if (!json?.access_token || !json?.user?.id) {
    throw new Error(json?.msg || "Could not start a Supabase session. Check that Anonymous Sign-Ins are enabled.");
  }
  const session = { access_token: json.access_token, refresh_token: json.refresh_token, user_id: json.user.id };
  await saveLocalSession(session);
  return session;
}

/* ----------------------------------------------------------------------
   CLOUD LOAD / SAVE
   Both throw on failure — the UI layer decides how to surface that
   (friendly "couldn't save" message + Try Again), it's never silently
   swallowed here.
------------------------------------------------------------------------ */
export async function supaLoad() {
  const session = await ensureSupabaseSession();
  if (!session) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_data?user_id=eq.${session.user_id}&select=data`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` } }
  );
  if (!res.ok) throw new Error(`Supabase load failed (${res.status})`);
  const rows = await res.json();
  return rows && rows[0] ? rows[0].data : null;
}

export async function supaSave(next) {
  const session = await ensureSupabaseSession();
  if (!session) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ user_id: session.user_id, data: next }),
  });
  if (!res.ok) throw new Error(`Supabase save failed (${res.status})`);
}

/* ----------------------------------------------------------------------
   LOCAL (ON-DEVICE) FALLBACK
   Used automatically whenever SUPABASE_CONFIGURED is false.
------------------------------------------------------------------------ */
export async function localLoad() {
  const res = await window.storage.get(STORAGE_KEY, false);
  return res ? JSON.parse(res.value) : null;
}

export async function localSave(next) {
  const res = await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
  if (!res) throw new Error("Local save returned no result.");
}

/* ----------------------------------------------------------------------
   ONE ENTRY POINT FOR THE UI
   loadUserData() / saveUserData() pick Supabase vs. local automatically,
   so the component layer never has to branch on SUPABASE_CONFIGURED.
------------------------------------------------------------------------ */
export async function loadUserData() {
  return SUPABASE_CONFIGURED ? await supaLoad() : await localLoad();
}

export async function saveUserData(next) {
  if (SUPABASE_CONFIGURED) await supaSave(next);
  else await localSave(next);
}

/* ----------------------------------------------------------------------
   DEFAULT DATA SHAPE
   The single source of truth for what a "fresh" user record looks like.
------------------------------------------------------------------------ */
export const emptyData = () => ({
  onboarded: false,
  profile: {},
  cycles: [],
  symptomLogs: [],
  lifestyleLogs: [],
});
