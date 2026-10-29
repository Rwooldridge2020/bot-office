export const SWITCH = "Office Switch";
const STATES = ["working", "waiting", "error", "done", "idle"];
const MIN = 60_000;

export type Bot = { name: string; paused: boolean; state: string; line: string; updated: string | null };
export type Snapshot = { read_at: number; paused: boolean; usage_line: string; bots: Bot[] };

const text = (p: any) => (p?.title ?? p?.rich_text ?? []).map((t: any) => t.plain_text).join("").trim();

export function readSwitch(page: any) {
  const p = page?.properties ?? {};
  return { paused: p["Office Paused"]?.checkbox === true, usage_line: text(p["Office Line"]).slice(0, 80) };
}

export function parseBots(pages: any[]): Bot[] {
  return pages.flatMap((page) => {
    const p = page.properties ?? {};
    const status = p.Status?.select?.name;
    if (status !== "Active" && status !== "Paused") return [];
    const state = p["Office State"]?.select?.name;
    return [{
      name: text(p["Bot Name"]).slice(0, 40),
      paused: status === "Paused",
      state: STATES.includes(state) ? state : "idle",
      line: text(p["Office Line"]).slice(0, 80),
      updated: p["Office Updated"]?.date?.start ?? null,
    }];
  });
}

export function view(snap: Snapshot | undefined, now: number, lead = "", assistant = "") {
  const bots = (snap?.bots ?? []).map((b) => {
    const fresh = b.updated !== null && now - Date.parse(b.updated) < 10 * MIN;
    return { ...b, state: fresh && !snap!.paused ? b.state : "idle", room: b.name === lead ? "lead" : b.name === assistant ? "assistant" : "" };
  });
  return {
    bots,
    paused: snap?.paused ?? false,
    usage_line: snap?.usage_line ?? "",
    read_at: snap ? new Date(snap.read_at).toISOString() : null,
    feed_warning: !snap || now - snap.read_at >= 45 * MIN,
  };
}
