import { DurableObject } from "cloudflare:workers";

interface Env {
  OFFICE: DurableObjectNamespace<OfficeState>;
  ASSETS: Fetcher;
  SITE_PASSWORD: string;
  WRITE_TOKEN: string;
}

type Status = { bot: string; state: string; line: string; ts: number };
type Usage = { pct_left: number; resets_at: string; read_at: string };

const STATES = ["working", "waiting", "error", "done", "idle"];
const MIN = 60_000;
const iso = (t?: number) => (t ? new Date(t).toISOString() : null);

export class OfficeState extends DurableObject {
  async setStatus(s: Status) {
    await this.ctx.storage.put({ ["bot:" + s.bot]: s, last_push: Date.now() });
  }

  async setUsage(u: Usage) {
    await this.ctx.storage.put({ usage: u, last_push: Date.now() });
  }

  async heartbeat() {
    await this.ctx.storage.put("heartbeat", Date.now());
  }

  async state() {
    const now = Date.now();
    const bots = [...(await this.ctx.storage.list<Status>({ prefix: "bot:" })).values()].map((s) => {
      const stale = s.state === "working" && now - s.ts > 10 * MIN;
      return { bot: s.bot, state: stale ? "idle" : s.state, stale, line: s.line, ts: iso(s.ts) };
    });
    const hb = await this.ctx.storage.get<number>("heartbeat");
    const push = await this.ctx.storage.get<number>("last_push");
    const old = (t?: number) => t !== undefined && now - t >= 45 * MIN;
    return {
      bots,
      usage: (await this.ctx.storage.get<Usage>("usage")) ?? null,
      heartbeat_at: iso(hb),
      last_push_at: iso(push),
      feed_warning: old(hb) || old(push),
    };
  }
}

async function sessionValue(env: Env) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SITE_PASSWORD), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("bot-office-session"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseStatus(b: any): Status | null {
  const ts = typeof b?.ts === "number" || typeof b?.ts === "string" ? new Date(b.ts).getTime() : NaN;
  if (typeof b?.bot !== "string" || !b.bot || b.bot.length > 40) return null;
  if (!STATES.includes(b.state) || typeof b.line !== "string" || b.line.length > 80 || isNaN(ts)) return null;
  return { bot: b.bot, state: b.state, line: b.line, ts };
}

function parseUsage(b: any): Usage | null {
  if (typeof b?.pct_left !== "number" || b.pct_left < 0 || b.pct_left > 100) return null;
  if (isNaN(Date.parse(b.resets_at)) || isNaN(Date.parse(b.read_at))) return null;
  return { pct_left: b.pct_left, resets_at: b.resets_at, read_at: b.read_at };
}

const LOGIN = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bot Office</title>
<form method="post" action="/login" style="font:16px system-ui;max-width:280px;margin:20vh auto;display:grid;gap:8px">
<label>Password <input type="password" name="password" autofocus required style="width:100%"></label><button>Enter</button></form>`;

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    const office = env.OFFICE.get(env.OFFICE.idFromName("office"));

    if (req.method === "POST" && (url.pathname === "/api/status" || url.pathname === "/api/usage")) {
      if (req.headers.get("Authorization") !== `Bearer ${env.WRITE_TOKEN}`) return new Response("unauthorized", { status: 401 });
      const body = await req.json().catch(() => null);
      if (url.pathname === "/api/status") {
        const s = parseStatus(body);
        if (!s) return new Response("bad request", { status: 400 });
        await office.setStatus(s);
      } else {
        const u = parseUsage(body);
        if (!u) return new Response("bad request", { status: 400 });
        await office.setUsage(u);
      }
      return new Response(null, { status: 204 });
    }

    const session = await sessionValue(env);
    if (req.method === "POST" && url.pathname === "/login") {
      const form = await req.formData();
      if (form.get("password") !== env.SITE_PASSWORD) return new Response(LOGIN, { status: 401, headers: { "Content-Type": "text/html" } });
      return new Response(null, {
        status: 303,
        headers: { Location: "/", "Set-Cookie": `office=${session}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000` },
      });
    }

    if (!(req.headers.get("Cookie") ?? "").split(/;\s*/).includes(`office=${session}`)) {
      return new Response(LOGIN, { status: 401, headers: { "Content-Type": "text/html" } });
    }
    if (req.method === "GET" && url.pathname === "/api/state") return Response.json(await office.state());
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    await env.OFFICE.get(env.OFFICE.idFromName("office")).heartbeat();
  },
} satisfies ExportedHandler<Env>;
