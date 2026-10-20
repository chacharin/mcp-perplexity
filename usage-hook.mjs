// usage-hook.mjs - usage log for the official Perplexity MCP server, loaded with `node --import ./usage-hook.mjs`.
//
// The official server receives token usage and cost from Perplexity with every answer but does not keep it.
// This hook wraps fetch: every call to PERPLEXITY_BASE_URL is passed through unchanged, while a copy of the
// response is read in the background for its usage. One JSON line per call goes to
// USAGE_DIR/usage-YYYY-MM-DD.jsonl (schema harness-usage/1, the same as the other servers and the agent),
// readable through GET http://<host>:USAGE_PORT/usage. Records hold token counts, sizes and timings only -
// never the question or the answer.
//
// Env: USAGE_LOG (true), USAGE_DIR (/app/usage), USAGE_PORT (8081, 0 = no endpoint),
//      USAGE_TOKEN (optional: GET /usage then needs "Authorization: Bearer <token>")
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";

const SCHEMA = "harness-usage/1";
const ENABLED = !["0", "false", "no", "off"].includes((process.env.USAGE_LOG || "true").trim().toLowerCase());
const DIR = (process.env.USAGE_DIR || "/app/usage").replace(/\/+$/, "");
const PORT = parseInt(process.env.USAGE_PORT ?? "8081", 10);
const TOKEN = (process.env.USAGE_TOKEN || "").trim();
const BASE = (process.env.PERPLEXITY_BASE_URL || "https://api.perplexity.ai").replace(/\/+$/, "");
// Agent API presets behind each tool of @perplexity-ai/mcp-server
const PRESET_TOOL = { fast: "perplexity_ask", medium: "perplexity_reason", high: "perplexity_research" };

function serverVersion() {
  try {
    const p = new URL("./node_modules/@perplexity-ai/mcp-server/package.json", import.meta.url);
    return JSON.parse(fs.readFileSync(p, "utf8")).version;
  } catch {
    return null;
  }
}

export const environment = {
  component: "mcp-perplexity", version: serverVersion(), host: os.hostname(),
  platform: `${os.type()} ${os.release()}`, machine: os.arch(), node: process.version,
  cpu_count: os.cpus().length, mem_total_mb: Math.round(os.totalmem() / 1048576),
};
export let lastError = null;

const r3 = (n) => (typeof n === "number" ? Math.round(n * 1000) / 1000 : null);
const day = (t) => {
  const d = new Date(t * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function write(record) {
  if (!ENABLED) return;
  const ts = Date.now() / 1000;
  const line = { schema: SCHEMA, ts: r3(ts), component: "mcp-perplexity", host: environment.host, ...record };
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(path.join(DIR, `usage-${day(ts)}.jsonl`), JSON.stringify(line) + "\n");
    lastError = null;
  } catch (e) {
    lastError = `${e.name}: ${e.message}`; // the usage log must never break a tool call
  }
}

export function read(since, until, limit = 50000) {
  let names = [];
  try {
    names = fs.readdirSync(DIR).filter((n) => n.startsWith("usage-") && n.endsWith(".jsonl")).sort();
  } catch {
    return [];
  }
  if (since != null) names = names.filter((n) => n.slice(6, 16) >= day(since));
  const out = [];
  for (const n of names) {
    let text = "";
    try {
      text = fs.readFileSync(path.join(DIR, n), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if ((since == null || r.ts >= since) && (until == null || r.ts < until)) out.push(r);
      } catch {
        /* skip a broken line */
      }
    }
  }
  return out.slice(-limit);
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// token fields from Perplexity's usage object (Agent API, Sonar or Search API - whichever names it uses)
export function tokens(u) {
  if (!u || typeof u !== "object") {
    return { input_tokens: null, output_tokens: null, reasoning_tokens: null, cache_read_tokens: null,
      cache_write_tokens: null, total_tokens: null, cost_usd: null, tokens_estimated: null };
  }
  const input = num(u.input_tokens) ?? num(u.prompt_tokens) ?? num(u.tokens) ?? 0;
  const output = num(u.output_tokens) ?? num(u.completion_tokens) ?? 0;
  const d = u.input_tokens_details || u.prompt_tokens_details || {};
  const cached = num(d.cache_read_input_tokens) || num(d.cached_tokens) || 0;
  const written = num(d.cache_creation_input_tokens) || 0;
  const reasoning = num(u.output_tokens_details?.reasoning_tokens) ?? num(u.reasoning_tokens)
    ?? num(u.completion_tokens_details?.reasoning_tokens) ?? 0;
  const c = u.cost;
  const cost = num(c) ?? num(c?.total_cost) ?? num(c?.total) ?? null;
  return { input_tokens: Math.max(input - cached - written, 0), output_tokens: output, reasoning_tokens: reasoning,
    cache_read_tokens: cached, cache_write_tokens: written, total_tokens: num(u.total_tokens) ?? input + output,
    cost_usd: cost, tokens_estimated: false };
}

function describe(url, init) {
  let body = null;
  try {
    body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
  } catch {
    body = null;
  }
  const endpoint = url.slice(BASE.length).replace(/^\/+/, "").split("?")[0];
  const tool = endpoint === "search" ? "perplexity_search"
    : endpoint === "v1/agent" ? (PRESET_TOOL[body?.preset] || "perplexity_agent") : endpoint;
  return { endpoint, tool, body, requestChars: typeof init?.body === "string" ? init.body.length : 0 };
}

function record(info, t0, first, status, final, extra) {
  const t1 = Date.now() / 1000;
  const tk = tokens(final?.usage);
  const gen = first ? t1 - first : t1 - t0;
  write({
    kind: info.endpoint === "search" ? "search_call" : "llm_call", tool: info.tool,
    model: final?.model ?? null, provider: "perplexity", endpoint_host: new URL(BASE).host,
    started_at: r3(t0), ended_at: r3(t1), duration_s: r3(t1 - t0), ttfb_s: first ? r3(first - t0) : null, ...tk,
    output_tps: tk.output_tokens && gen > 0 ? Math.round((tk.output_tokens / gen) * 100) / 100 : null,
    status: extra.error || status >= 400 ? "error" : "ok", error: extra.error || (status >= 400 ? `HTTP ${status}` : null),
    finish_reason: final?.status ?? null,
    detail: { endpoint: info.endpoint, preset: info.body?.preset ?? null, http_status: status,
      request_chars: info.requestChars, response_chars: extra.responseChars ?? null,
      search_queries: extra.searchQueries ?? null, search_results: extra.searchResults ?? null,
      max_results: info.body?.max_results ?? null, usage_raw: final?.usage ?? null },
  });
}

// read the Agent API event stream: the final response (usage), first event time, searches made
async function consume(stream, info, t0, status) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "", first = null, final = null, error = null, chars = 0, queries = 0, results = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (first === null) first = Date.now() / 1000;
      chars += value.length;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        let ev;
        try {
          ev = JSON.parse(t.slice(5).trim());
        } catch {
          continue;
        }
        if (ev.type === "response.completed") final = ev.response;
        else if (ev.type === "response.failed" || ev.type === "error") error = ev.error?.type || "failed";
        else if (ev.type === "response.reasoning.search_queries") queries += (ev.queries || []).length;
        else if (ev.type === "response.reasoning.search_results") results += (ev.results || []).length;
      }
      if (final || error) break;
    }
  } catch (e) {
    error = error || e.name;
  } finally {
    reader.cancel().catch(() => {});
  }
  record(info, t0, first, status, final, { error: error || (final ? null : status < 400 ? "no_final_response" : null),
    responseChars: chars, searchQueries: queries, searchResults: results });
}

const realFetch = globalThis.fetch;
globalThis.fetch = async function meteredFetch(input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
  if (!ENABLED || typeof url !== "string" || !url.startsWith(BASE)) return realFetch(input, init);
  const info = describe(url, init);
  const t0 = Date.now() / 1000;
  let res;
  try {
    res = await realFetch(input, init);
  } catch (e) {
    record(info, t0, null, 0, null, { error: e.name });
    throw e;
  }
  const ctype = res.headers.get("content-type") || "";
  if (res.body && ctype.includes("text/event-stream")) {
    const [mine, theirs] = res.body.tee();
    consume(mine, info, t0, res.status);
    return new Response(theirs, { status: res.status, statusText: res.statusText, headers: res.headers });
  }
  res.clone().text().then((text) => {
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    record(info, t0, null, res.status, data, { responseChars: text.length,
      searchResults: Array.isArray(data?.results) ? data.results.length : null });
  }).catch((e) => record(info, t0, null, res.status, null, { error: e.name }));
  return res;
};

function authorized(req) {
  if (!TOKEN) return true;
  const got = Buffer.from(req.headers.authorization || "");
  const want = Buffer.from(`Bearer ${TOKEN}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export const usageServer = PORT > 0 ? http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const send = (code, body) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (u.pathname === "/health") return send(200, { ok: true, usage_log: { enabled: ENABLED, dir: DIR, last_error: lastError } });
  if (u.pathname !== "/usage") return send(404, { error: "not found" });
  if (!authorized(req)) return send(401, { error: "unauthorized" });
  const f = (k) => (u.searchParams.get(k) ? Number(u.searchParams.get(k)) : null);
  send(200, { schema: SCHEMA, environment, records: read(f("since"), f("until"), f("limit") || 50000) });
}) : null;
usageServer?.listen(PORT, "0.0.0.0");
usageServer?.unref();   // never keeps the process alive on its own
