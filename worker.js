// ─── THE FOUNDRY — Cloudflare Worker ─────────────────────────────────────────
// Routes:
//   POST /          — Anthropic AI proxy
//   POST /subscribe — Brevo email list subscription
//   POST /feedback  — Brevo transactional email (user feedback → timberandcode3@gmail.com)
//
// Secrets (set via: cd ~/foundry-worker && wrangler secret put SECRET_NAME --config wrangler.toml):
//   ANTHROPIC_API_KEY  — Anthropic API key
//   BREVO_API_KEY      — Brevo (Sendinblue) API key
//   FOUNDRY_APP_KEY    — Shared secret for app-level auth gate
//
// Constants (not sensitive — safe in source):
const BREVO_LIST_ID = 2;
const ALLOWED_ORIGINS = [
  "https://thefoundry.coach",
  "https://www.thefoundry.coach",
  "https://timber-and-code.github.io",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin?.startsWith("http://localhost") || origin?.startsWith("http://127.0.0.1");
  return {
    "Access-Control-Allow-Origin":  allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Foundry-Key",
  };
}

function respond(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url    = new URL(request.url);

    // ── CORS preflight ───────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ── Auth gate — every POST must carry the shared secret ──────────────────
    if (request.method === "POST") {
      const appKey = request.headers.get("X-Foundry-Key") || "";
      if (!env.FOUNDRY_APP_KEY || appKey !== env.FOUNDRY_APP_KEY) {
        return respond({ error: "Unauthorized" }, 401, origin);
      }
    }

    // ── POST /subscribe — Brevo email list ───────────────────────────────────
    if (request.method === "POST" && url.pathname === "/subscribe") {
      let email;
      try {
        const body = await request.json();
        email = (body.email || "").trim().toLowerCase();
      } catch {
        return respond({ error: "Invalid request body" }, 400, origin);
      }
      if (!email || !email.includes("@")) {
        return respond({ error: "Invalid email address" }, 400, origin);
      }
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key":      env.BREVO_API_KEY,
          },
          body: JSON.stringify({
            email,
            listIds: [BREVO_LIST_ID],
            updateEnabled: true,
          }),
        });
        if (!brevoRes.ok) {
          const err = await brevoRes.text();
          console.error("Brevo API error:", brevoRes.status, err);
          return respond({ error: "Subscription failed" }, 502, origin);
        }
        return respond({ success: true }, 200, origin);
      } catch (err) {
        console.error("Brevo fetch error:", err);
        return respond({ error: "Internal error" }, 500, origin);
      }
    }

    // ── POST /feedback — Brevo transactional email ─────────────────────────────
    if (request.method === "POST" && url.pathname === "/feedback") {
      let message, appVersion, device;
      try {
        const body = await request.json();
        message    = (body.message || "").trim();
        appVersion = body.appVersion || "unknown";
        device     = body.device || "unknown";
      } catch {
        return respond({ error: "Invalid request body" }, 400, origin);
      }
      if (!message) {
        return respond({ error: "Message is required" }, 400, origin);
      }
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key":      env.BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: { name: "The Foundry", email: "timberandcode3@gmail.com" },
            to:     [{ email: "timberandcode3@gmail.com" }],
            subject: `Foundry Feedback — v${appVersion}`,
            htmlContent: `
              <h2>New Feedback from The Foundry</h2>
              <p><strong>Version:</strong> ${appVersion}</p>
              <p><strong>Device:</strong> ${device}</p>
              <hr/>
              <p>${message.replace(/\n/g, "<br/>")}</p>
            `,
          }),
        });
        if (!brevoRes.ok) {
          const err = await brevoRes.text();
          console.error("Brevo feedback error:", brevoRes.status, err);
          return respond({ error: "Feedback send failed" }, 502, origin);
        }
        return respond({ success: true }, 200, origin);
      } catch (err) {
        console.error("Brevo feedback fetch error:", err);
        return respond({ error: "Internal error" }, 500, origin);
      }
    }

    // ── POST / — Anthropic AI proxy ──────────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/") {
      let body;
      try {
        body = await request.json();
      } catch {
        return respond({ error: "Invalid request body" }, 400, origin);
      }
      try {
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type":      "application/json",
            "x-api-key":         env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
        });
        const data = await aiRes.json();
        return respond(data, aiRes.status, origin);
      } catch (err) {
        console.error("Anthropic fetch error:", err);
        return respond({ error: "AI request failed" }, 500, origin);
      }
    }

    // 404 for anything else
    return respond({ error: "Not found" }, 404, origin);
  },
};
