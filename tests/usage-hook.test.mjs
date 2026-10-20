// node --test tests/ - the usage hook against a fake Perplexity API (no network, no key)
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const USAGE = { input_tokens: 1200, output_tokens: 300, total_tokens: 1500,
  input_tokens_details: { cached_tokens: 200, cache_creation_input_tokens: 100 }, output_tokens_details: { reasoning_tokens: 40 },
  cost: { total_cost: 0.0061 } };

const sse = (events) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
const fake = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url === "/search") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ results: [{ title: "a", url: "u" }, { title: "b", url: "v" }], usage: { tokens: 0 } }));
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(sse([
      { type: "response.created", response: { id: "r1" } },
      { type: "response.reasoning.search_queries", queries: ["q1", "q2"] },
      { type: "response.reasoning.search_results", results: [{}, {}, {}] },
      { type: "response.completed", response: { id: "r1", model: "sonar-pro", status: "completed", output: [], usage: USAGE } },
    ]));
  });
});

let hook, base, dir;
before(async () => {
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${fake.address().port}`;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "usage-"));
  Object.assign(process.env, { PERPLEXITY_BASE_URL: base, USAGE_DIR: dir, USAGE_PORT: "0" });
  hook = await import("../usage-hook.mjs");
});
after(() => fake.close());

const settle = () => new Promise((r) => setTimeout(r, 100));

test("an agent answer is passed through and its usage logged without text", async () => {
  const res = await fetch(`${base}/v1/agent`, { method: "POST", body: JSON.stringify({ preset: "high", input: "secret question" }) });
  const text = await res.text();
  assert.match(text, /response\.completed/);                      // the caller still gets every event
  await settle();
  const rec = hook.read().at(-1);
  assert.equal(rec.kind, "llm_call");
  assert.equal(rec.tool, "perplexity_research");
  assert.deepEqual([rec.input_tokens, rec.cache_read_tokens, rec.cache_write_tokens, rec.output_tokens, rec.reasoning_tokens],
    [900, 200, 100, 300, 40]);
  assert.equal(rec.cost_usd, 0.0061);
  assert.equal(rec.model, "sonar-pro");
  assert.deepEqual([rec.detail.search_queries, rec.detail.search_results], [2, 3]);
  assert.ok(!JSON.stringify(rec).includes("secret question"));
});

test("a search call is logged", async () => {
  const res = await fetch(`${base}/search`, { method: "POST", body: JSON.stringify({ query: "x", max_results: 5 }) });
  assert.equal((await res.json()).results.length, 2);
  await settle();
  const rec = hook.read().at(-1);
  assert.equal(rec.kind, "search_call");
  assert.equal(rec.tool, "perplexity_search");
  assert.equal(rec.detail.search_results, 2);
  assert.equal(rec.detail.max_results, 5);
});

test("other hosts are not touched", async () => {
  const before = hook.read().length;
  await fetch(`${base.replace("127.0.0.1", "localhost")}/search`, { method: "POST", body: "{}" }).then((r) => r.text());
  await settle();
  assert.equal(hook.read().length, before);
});

test("a failed connection is logged as an error", async () => {
  fake.close();
  await assert.rejects(fetch(`${base}/v1/agent`, { method: "POST", body: "{}" }));
  await settle();
  const rec = hook.read().at(-1);
  assert.equal(rec.status, "error");
});
