import { DurableObject } from "cloudflare:workers";
import { SWITCH, parseBots, readSwitch, view, type Snapshot } from "./office";

interface Env {
  OFFICE: DurableObjectNamespace<OfficeState>;
  ASSETS: Fetcher;
  SITE_PASSWORD: string;
  NOTION_OFFICE_TOKEN: string;
  NOTION_DB_ID: string;
  OFFICE_LEAD?: string;
  OFFICE_ASSISTANT?: string;
}

export class OfficeState extends DurableObject<Env> {
  async refresh() {
    const query = async (body: object) => {
      const res = await fetch(`https://api.notion.com/v1/databases/${this.env.NOTION_DB_ID}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.env.NOTION_OFFICE_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`notion ${res.status}`);
      return res.json<{ results: any[]; has_more: boolean; next_cursor: string }>();
    };
    const sw = readSwitch((await query({ filter: { property: "Bot Name", title: { equals: SWITCH } }, page_size: 1 })).results[0]);
    let bots = (await this.ctx.storage.get<Snapshot>("snap"))?.bots ?? [];
    if (!sw.paused) {
      const pages = [];
      let cursor: string | undefined;
      do {
        const r = await query({ page_size: 100, start_cursor: cursor });
        pages.push(...r.results);
        cursor = r.has_more ? r.next_cursor : undefined;
      } while (cursor);
      bots = parseBots(pages);
    }
    await this.ctx.storage.put("snap", { read_at: Date.now(), ...sw, bots } satisfies Snapshot);
  }

  async state() {
    return view(await this.ctx.storage.get<Snapshot>("snap"), Date.now(), this.env.OFFICE_LEAD, this.env.OFFICE_ASSISTANT);
  }
}

async function sessionValue(env: Env) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SITE_PASSWORD), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("bot-office-session"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const LOGIN = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bot Office</title>
<form method="post" action="/login" style="font:16px system-ui;max-width:280px;margin:20vh auto;display:grid;gap:8px">
<label>Password <input type="password" name="password" autofocus required style="width:100%"></label><button>Enter</button></form>`;

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
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
    if (req.method === "GET" && url.pathname === "/api/state") return Response.json(await env.OFFICE.get(env.OFFICE.idFromName("office")).state());
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    await env.OFFICE.get(env.OFFICE.idFromName("office")).refresh();
  },
} satisfies ExportedHandler<Env>;
