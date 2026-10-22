// node --test tests/ - the ENABLE_PERPLEXITY_* switches against the real official server (no network, no key use)
import assert from "node:assert/strict";
import { test } from "node:test";

Object.assign(process.env, {
  PERPLEXITY_API_KEY: "test-key-not-real",
  ENABLE_PERPLEXITY_ASK: "false",
  ENABLE_PERPLEXITY_RESEARCH: "OFF",
  ENABLE_PERPLEXITY_REASON: "maybe",      // not a boolean: stays on, reported as a problem
});
const hook = await import("../tools-hook.mjs");
const { createPerplexityServer } = await import("@perplexity-ai/mcp-server");
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");

async function connect() {
  const server = createPerplexityServer();
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(b);
  return client;
}

test("switched-off tools are not listed", async () => {
  const client = await connect();
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["perplexity_reason", "perplexity_search"]);
});

test("a switched-off tool cannot be called directly", async () => {
  const client = await connect();
  const res = await client.callTool({ name: "perplexity_ask", arguments: { messages: [{ role: "user", content: "x" }] } })
    .catch((e) => ({ isError: true, content: [{ text: String(e.message) }] }));
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /disabled|not found/i);
});

test("unset means on; true/false/1/0/yes/no/on/off are understood; anything else is reported", () => {
  assert.deepEqual(hook.readSwitches({}).enabled,
    { perplexity_search: true, perplexity_ask: true, perplexity_reason: true, perplexity_research: true });
  const s = hook.readSwitches({ ENABLE_PERPLEXITY_SEARCH: "No", ENABLE_PERPLEXITY_ASK: "1", ENABLE_PERPLEXITY_REASON: " FALSE " });
  assert.deepEqual([s.enabled.perplexity_search, s.enabled.perplexity_ask, s.enabled.perplexity_reason], [false, true, false]);
  assert.equal(s.problems.length, 0);
  assert.match(hook.switches.problems[0], /ENABLE_PERPLEXITY_REASON=maybe/);
});

test("all off is reported", () => {
  const s = hook.readSwitches(Object.fromEntries(hook.TOOLS.map((t) => [`ENABLE_${t.toUpperCase()}`, "false"])));
  assert.match(s.problems.at(-1), /no tool/);
});
