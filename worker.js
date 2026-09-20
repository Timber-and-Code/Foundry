// ─── THE FOUNDRY — Cloudflare Worker ─────────────────────────────────────────
// Routes:
//   POST /          — the coach: builds a program with Claude (signed-in users)
//   POST /subscribe — Brevo email list subscription (public)
//
// Deploy (Node 22):  npx wrangler deploy          (from the repo root)
// Secrets:           npx wrangler secret put ANTHROPIC_API_KEY | BREVO_API_KEY
//                    npx wrangler secret put SUPABASE_ANON_KEY   (public value, kept out of git)
// Vars (wrangler.toml): SUPABASE_URL
//
// Auth — why not a shared app key: anything shipped in a web or app bundle is
// public, so a shared key protects nothing. The coach instead requires the
// caller's Supabase session token and verifies it with Supabase. (The old
// worker demanded an X-Foundry-Key the clients never had — signed-in clients
// sent a Bearer token, signed-out ones an empty key — so it answered 401 to
// every request and the coach silently never ran in production.)
//
// The model, token ceiling and effort are pinned HERE. The client sends only
// the prompt, so the endpoint can't be used as a general-purpose model proxy,
// and a model upgrade is a worker deploy rather than an app release.

// Defaults; override per deploy with COACH_MODEL / COACH_EFFORT in wrangler.toml [vars].
const DEFAULT_COACH_MODEL = "claude-opus-5";
const DEFAULT_COACH_EFFORT = "medium";
const COACH_MAX_TOKENS = 16000;      // thinking + a ~4k-token program, with room
const MAX_PROMPT_CHARS = 120000;     // exercise library (~250 rows) + instructions ≈ 30k

const BREVO_LIST_ID = 2;
const ALLOWED_ORIGINS = [
  "https://thefoundry.coach",
  "https://www.thefoundry.coach",
  "capacitor://localhost",          // iOS app (Capacitor)
  "https://localhost",              // Android app (Capacitor, androidScheme https)
];

function corsHeaders(origin) {
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin?.startsWith("http://localhost") ||
    origin?.startsWith("http://127.0.0.1");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Foundry-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function respond(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/** The signed-in Supabase user for this request, or null. */
async function verifyUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user && user.id ? user : null;
  } catch (err) {
    console.error("Supabase verify error:", err);
    return null;
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ── POST /subscribe — Brevo email list (public: it's a sign-up form) ─────
    if (request.method === "POST" && url.pathname === "/subscribe") {
      let email;
      try {
        const body = await request.json();
        email = String(body.email || "").trim().toLowerCase();
      } catch {
        return respond({ error: "Invalid request body" }, 400, origin);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return respond({ error: "Invalid email address" }, 400, origin);
      }
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": env.BREVO_API_KEY },
          body: JSON.stringify({ email, listIds: [BREVO_LIST_ID], updateEnabled: true }),
        });
        if (!brevoRes.ok) {
          console.error("Brevo API error:", brevoRes.status, await brevoRes.text());
          return respond({ error: "Subscription failed" }, 502, origin);
        }
        return respond({ success: true }, 200, origin);
      } catch (err) {
        console.error("Brevo fetch error:", err);
        return respond({ error: "Internal error" }, 500, origin);
      }
    }

    // ── POST / — the coach ───────────────────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/") {
      const user = await verifyUser(request, env);
      if (!user) return respond({ error: "Sign in to use the coach" }, 401, origin);

      if (env.COACH_LIMITER) {
        const { success } = await env.COACH_LIMITER.limit({ key: user.id });
        if (!success) return respond({ error: "Too many coach requests — try again in a minute" }, 429, origin);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return respond({ error: "Invalid request body" }, 400, origin);
      }
      // New clients send { prompt }. Older builds sent a full Messages body —
      // take the prompt out of it and ignore their model / max_tokens.
      const legacy = Array.isArray(body?.messages) ? body.messages[0]?.content : undefined;
      const prompt = typeof body?.prompt === "string" ? body.prompt : typeof legacy === "string" ? legacy : "";
      if (!prompt.trim()) return respond({ error: "Missing prompt" }, 400, origin);
      if (prompt.length > MAX_PROMPT_CHARS) return respond({ error: "Prompt too large" }, 413, origin);

      try {
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            // A declined request is re-run on Anthropic's recommended fallback
            // model inside the same call instead of coming back as a refusal.
            "anthropic-beta": "server-side-fallback-2026-07-01",
          },
          body: JSON.stringify({
            model: env.COACH_MODEL || DEFAULT_COACH_MODEL,
            max_tokens: COACH_MAX_TOKENS,
            thinking: { type: "adaptive" },
            output_config: { effort: env.COACH_EFFORT || DEFAULT_COACH_EFFORT },
            fallbacks: "default",
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const data = await aiRes.json();
        if (!aiRes.ok) {
          console.error("Anthropic error:", aiRes.status, JSON.stringify(data).slice(0, 500));
          return respond({ error: "The coach is unavailable right now" }, 502, origin);
        }
        if (data.stop_reason === "refusal" || data.stop_reason === "max_tokens") {
          console.error("Coach stopped early:", data.stop_reason, JSON.stringify(data.stop_details || {}));
          return respond({ error: "The coach couldn't finish this program" }, 502, origin);
        }
        return respond(data, 200, origin);
      } catch (err) {
        console.error("Anthropic fetch error:", err);
        return respond({ error: "AI request failed" }, 500, origin);
      }
    }

    return respond({ error: "Not found" }, 404, origin);
  },
};
