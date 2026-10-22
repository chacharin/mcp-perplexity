# mcp-perplexity

**English** | [ภาษาไทย](README.th.md)

A ready-to-run Docker setup of the [official Perplexity MCP server](https://www.npmjs.com/package/@perplexity-ai/mcp-server)
that gives AI agents and assistants **web search**, **question answering with citations**, **step-by-step reasoning** and
**deep research**, powered by [Perplexity](https://www.perplexity.ai).

Any [MCP](https://modelcontextprotocol.io) client that supports streamable HTTP can use it, for example Claude Code,
Claude Desktop, VS Code, Cursor or your own agent. The Perplexity API key stays in the container, and every call is logged with its
tokens, time and cost, so you always know what your agent spent. You do not need Node.js on your machine.

> This project packages the official Perplexity MCP server; it does not reimplement it. The server is developed by Perplexity AI
> under the MIT license. This project is not an official Perplexity product.

- [What you get](#what-you-get)
- [Tools](#tools)
- [How it works](#how-it-works)
- [Quick start (Docker)](#quick-start-docker)
- [Running without Docker](#running-without-docker)
- [Connecting an MCP client](#connecting-an-mcp-client)
- [Calling it directly (JSON)](#calling-it-directly-json)
- [Turning tools on and off](#turning-tools-on-and-off)
- [Usage and cost data](#usage-and-cost-data)
- [Configuration reference](#configuration-reference)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## What you get

- **Four tools, from cheap to thorough.** Raw search results, quick answers, reasoned answers and full research reports. Pick
  the depth you need per task.
- **Answers with citations.** The answering tools return text with reference numbers such as `[2][3]` and a list of source
  URLs.
- **Only the tools you want.** Each tool has its own switch in `.env`. The example file turns on only `perplexity_search`, the
  fastest and cheapest. A tool that is off disappears from the client's tool list.
- **Token, time and cost log.** Perplexity reports tokens and cost with every answer, but the official server drops them. This
  project records them, one JSON line per call, at `GET /usage`. Numbers only, never the question or the answer.
- **The official server, unchanged.** Two small hook files are loaded before it with `node --import`. Updating to a new
  Perplexity release means changing one version number.
- **Locked dependencies.** `package-lock.json` pins the server and every library, so every build is the same.

## Tools

| Tool | What it does | Perplexity API | Speed and cost | On in `.env.example` |
|---|---|---|---|---|
| `perplexity_search` | Searches the web and returns the results as they are: title, URL, an excerpt of the page and the date. No AI summary | Search API | Fast, cheapest | yes |
| `perplexity_ask` | Answers a question from the web, with citations | Agent API, preset `fast` | Fast | yes |
| `perplexity_reason` | Works through a question step by step (compare, calculate, explain why), grounded in the web | Agent API, preset `medium` | Medium | yes |
| `perplexity_research` | Researches a topic across many sources and writes a report with citations | Agent API, preset `high` | Slow (can take minutes), most expensive | yes |

All tools are read-only. Every call is billed to your `PERPLEXITY_API_KEY`. See current prices on the
[Perplexity pricing page](https://docs.perplexity.ai/getting-started/pricing).

You do not call the tools yourself: you ask your agent in plain language and it picks the tool and fills in the parameters. To
steer it, say what you want, e.g. *"quick web search"* or *"do deep research on…"*, because cost and time differ a lot between
tools.

### `perplexity_search`

Example requests to an agent: *"Find the GitHub link of LightRAG"*, *"News about EU AI policy this week, only from europa.eu"*.

| Parameter | Required | Meaning |
|---|---|---|
| `query` | ✓ | The search terms |
| `max_results` | | Number of results, 1–20 (default 10) |
| `max_tokens_per_page` | | Most tokens taken from each page (default 1024) |
| `country` | | Two-letter ISO 3166-1 country code, e.g. `US` or `TH`, for results from that country |
| `search_recency_filter` | | `hour`, `day`, `week`, `month` or `year` |
| `search_domain_filter` | | Only these domains, e.g. `["wikipedia.org"]`, or leave domains out with `-`, e.g. `["-reddit.com"]` |
| `search_type` | | `web` (default) or `fast` (faster and cheaper) |

Best when you want original sources, or when your agent should read and summarize by itself.

### `perplexity_ask` and `perplexity_reason`

Example requests: *"What is LightRAG? Keep it short."*, *"Compare the energy use of the three largest data-center regions."*

| Parameter | Required | Meaning |
|---|---|---|
| `messages` | ✓ | The conversation: a list of `{role, content}` with role `system`, `user` or `assistant` |
| `search_recency_filter` | | `hour`, `day`, `week`, `month` or `year` |
| `search_domain_filter` | | Same as in `perplexity_search` |
| `search_context_size` | | How much web content is used: `low` (fastest), `medium`, `high` (most complete) |

The answer is text with reference numbers such as `[2][3]` and the list of source URLs at the end.

### `perplexity_research`

Example request: *"Do deep research on how governments use retrieval-augmented generation and write a report."*

Takes only `messages`. It can run for several minutes and costs the most, so use it when you really need a report from many
sources, and give your client a long enough timeout (see [Connecting an MCP client](#connecting-an-mcp-client)).

## How it works

```
MCP client / agent ──POST /mcp──▶ mcp-perplexity (container, port 8080)
                                    ① checks the Host header against ALLOWED_HOSTS (HTTP 421 if not listed)
                                    ② tools-hook.mjs has removed the tools that are switched off
                                    ③ the tool calls https://api.perplexity.ai with PERPLEXITY_API_KEY
                                    ④ usage-hook.mjs reads a copy of the answer and logs tokens, time and cost
                  ◀── the answer goes back to the client unchanged

usage/*.jsonl ──GET /usage (port 8081, docker network only)──▶ your spreadsheet, dashboard or research
```

The server keeps no state and has no database. The only volume holds the usage log.

## Quick start (Docker)

You need [Docker](https://docs.docker.com/get-docker/) with Docker Compose, an internet connection for the first build (to
download the Node image and npm packages), and a Perplexity API key from [console.perplexity.ai](https://console.perplexity.ai).

**1. Get the code**

```bash
git clone https://github.com/chacharin/mcp-perplexity.git
```

```bash
cd mcp-perplexity
```

**2. Create the docker network** (once per machine). Containers on this network, such as an agent running in Docker, reach the
server by name. Skip this step if the network already exists.

```bash
docker network create agent_network
```

**3. Create `.env` and put your key in it**

```bash
cp .env.example .env
```

Open `.env` and replace the example value of `PERPLEXITY_API_KEY` with your key. Only `perplexity_search` is on; to use the other
tools, set their `ENABLE_PERPLEXITY_…` lines to `true` (see [Turning tools on and off](#turning-tools-on-and-off)).

**4. Start the server**

```bash
docker compose up -d --build
```

**5. Check it**

```bash
curl http://127.0.0.1:8803/health
```

`{"status":"ok", …}` means the server is running. It does not check the key: a wrong key shows up as `401 Unauthorized` on the
first tool call.

The MCP endpoint is now `http://localhost:8803/mcp` on this machine, and `http://mcp-perplexity:8080/mcp` from other containers
on `agent_network`.

After editing `.env`, run `docker compose up -d` again (no rebuild needed). To stop the server, run `docker compose down`. The usage
log is kept in the `usage` volume.

## Running without Docker

You need Node.js 22 or newer.

```bash
npm ci --omit=dev
```

Add these lines to `.env` so the server listens on port 8803 of this machine only and keeps its log in the project folder:

```
BIND_ADDRESS=127.0.0.1
PORT=8803
ALLOWED_HOSTS=localhost:8803,127.0.0.1:8803
USAGE_DIR=./usage
```

```bash
node --env-file=.env --import ./tools-hook.mjs --import ./usage-hook.mjs node_modules/@perplexity-ai/mcp-server/dist/http.js
```

The usage endpoints are then at `http://127.0.0.1:8081/health` and `http://127.0.0.1:8081/usage`.

## Connecting an MCP client

The server speaks **streamable HTTP**. Use the URL that your client can reach:

| Where the client runs | URL | Must be in `ALLOWED_HOSTS` |
|---|---|---|
| The same machine | `http://localhost:8803/mcp` | `localhost:8803` (already in the example) |
| Another container on `agent_network` | `http://mcp-perplexity:8080/mcp` | `mcp-perplexity:8080` (already in the example) |
| Another machine on your network | `http://<server-ip>:8803/mcp` | `<server-ip>:8803` (add it; see [Security](#security)) |

**Set a long timeout.** `perplexity_research` can take several minutes. If the client gives up first, it reports a failure while
Perplexity keeps working and still bills the call. 600 seconds is a safe value.

**Claude Code**

```bash
claude mcp add --transport http perplexity http://localhost:8803/mcp
```

**Claude Desktop** (`claude_desktop_config.json`, through the [mcp-remote](https://www.npmjs.com/package/mcp-remote) bridge;
needs Node.js)

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:8803/mcp"]
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`)

```json
{
  "servers": {
    "perplexity": { "type": "http", "url": "http://localhost:8803/mcp" }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "perplexity": { "url": "http://localhost:8803/mcp" }
  }
}
```

**Hermes Agent** (`config.yaml`)

```yaml
mcp_servers:
  perplexity:
    url: http://mcp-perplexity:8080/mcp
    timeout: 600
```

**Other clients:** use the URL above with the streamable HTTP transport. A client that runs inside a web page (or MCP Inspector
in *Direct* mode) also needs its page address in `ALLOWED_ORIGINS`.

**Try it without an agent** using [MCP Inspector](https://github.com/modelcontextprotocol/inspector) (needs Node.js):

```bash
npx @modelcontextprotocol/inspector
```

In the page that opens, choose Transport = *Streamable HTTP*, URL = `http://localhost:8803/mcp`, Connection type = *Via Proxy*,
press *Connect*, then open *Tools* and run `perplexity_search`.

**A tip for your agent's instructions.** Tell it when to use which tool, for example: *"Use perplexity_search for facts and
sources. Use perplexity_research only when I ask for a report. Cite every URL you use."*

## Calling it directly (JSON)

The server has these routes:

| Route | Port | Purpose |
|---|---|---|
| `POST /mcp` | 8080 (published as 8803) | All tools, in the MCP standard (JSON-RPC 2.0) |
| `GET /health` | 8080 (published as 8803) | Is the server running? Does not check the key and costs nothing |
| `GET /health` | 8081 (docker network only) | Which tools are on, settings that could not be read, state of the usage log |
| `GET /usage` | 8081 (docker network only) | Tokens, time and cost of every Perplexity call |

Every request to `/mcp` needs these two headers, and the Host it uses must be in `ALLOWED_HOSTS`:

```
Content-Type: application/json
Accept: application/json, text/event-stream
```

The server answers with plain JSON. Each tool's text is in `result.content[0].text`, and again in `result.structuredContent`
(key `results` for `perplexity_search`, `response` for the other tools).

**List the tools** (free)

```json
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
```

Only tools that are switched on are listed.

**Search**

```json
{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
  "name": "perplexity_search",
  "arguments": {"query": "LightRAG HKUDS GitHub", "max_results": 2}
}}
```

Reply (shortened):

```json
{"jsonrpc": "2.0", "id": 2, "result": {
  "content": [{"type": "text",
    "text": "Found 2 search results:\n\n1. **[EMNLP2025] LightRAG: Simple and Fast Retrieval- ...**\n   URL: https://github.com/hkuds/lightrag\n   GitHub - HKUDS/LightRAG: … LightRAG is a lightweight knowledge-graph RAG framework …\n   Date: …\n\n2. …"}],
  "structuredContent": {"results": "Found 2 search results: …"}
}}
```

**Ask** (`perplexity_ask`, `perplexity_reason` and `perplexity_research` take the same request)

```json
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {
  "name": "perplexity_ask",
  "arguments": {
    "messages": [{"role": "user", "content": "What is LightRAG? Answer in two sentences."}],
    "search_context_size": "low"
  }
}}
```

Reply (shortened):

```json
{"jsonrpc": "2.0", "id": 3, "result": {
  "content": [{"type": "text",
    "text": "LightRAG is a RAG framework that builds a knowledge graph from documents and combines graph and vector retrieval …[2][3]\n\nCitations:\n[1] …\n[2] https://arxiv.org/html/2410.05779v1\n[3] https://github.com/hkuds/lightrag"}],
  "structuredContent": {"response": "LightRAG is a RAG framework … Citations: …"}
}}
```

**With curl** (this calls Perplexity and is billed; use `"method":"tools/list"` without `params` to test for free)

```bash
curl http://127.0.0.1:8803/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"perplexity_search","arguments":{"query":"LightRAG HKUDS GitHub","max_results":2}}}'
```

On Windows, curl may turn non-English text typed on the command line into `?`. Save the request as a UTF-8 file such as
`request.json` and send it with `-d @request.json`.

## Turning tools on and off

Each tool has its own line in `.env`. `true`/`false`, `1`/`0`, `yes`/`no` and `on`/`off` all work. The example file has:

```
ENABLE_PERPLEXITY_SEARCH=true
ENABLE_PERPLEXITY_ASK=false
ENABLE_PERPLEXITY_REASON=false
ENABLE_PERPLEXITY_RESEARCH=false
```

- A tool that is off is **not in the tool list**, so the agent never sees it, its description costs no tokens, and a direct call
  is refused. This works the same for every client.
- A line that is missing counts as `true`, so an older `.env` without these lines keeps all four tools.
- A value that cannot be read, such as `maybe`, keeps the tool on and is reported in the log and at `GET :8081/health`.
- Apply a change with `docker compose up -d`, then reconnect or restart the client. Clients read the tool list when they connect.

Check the switches at `http://mcp-perplexity:8081/health` (from the docker network):

```json
{"ok": true, "tools": {"perplexity_search": true, "perplexity_ask": false, "…": "…"}, "problems": [], "…": "…"}
```

## Usage and cost data

The log is JSON Lines in the `usage` volume, one file per day (`usage-YYYY-MM-DD.jsonl`), in the `harness-usage/1` schema. It
holds **numbers only**: no questions, answers or search terms.

Read it from a container on the docker network, for example:

```bash
docker run --rm --network agent_network curlimages/curl -s http://mcp-perplexity:8081/usage
```

| Parameter | Meaning |
|---|---|
| `since`, `until` | Time range in Unix seconds. Without them, everything is returned |
| `limit` | Most records returned, default 50,000 (the newest are kept) |

| `kind` | Written for | Main fields |
|---|---|---|
| `search_call` | `perplexity_search` | `duration_s`, `status`, number of results (the Search API reports no tokens) |
| `llm_call` | the other three tools | `model`, `duration_s`, `ttfb_s`, `input_tokens`, `output_tokens`, `reasoning_tokens`, `cache_read_tokens`, `cache_write_tokens`, `cost_usd`, `detail.preset`, `detail.search_queries`, `detail.usage_raw` |

Example record (shortened) after one `perplexity_ask` call:

```json
{"kind": "llm_call", "tool": "perplexity_ask", "model": "openai/gpt-6-luna", "provider": "perplexity",
 "duration_s": 2.342, "ttfb_s": 0.803, "input_tokens": 3, "cache_write_tokens": 5705, "output_tokens": 16,
 "total_tokens": 5724, "cost_usd": 0.00172, "status": "ok",
 "detail": {"endpoint": "v1/agent", "preset": "fast", "search_queries": 1, "search_results": 5,
            "usage_raw": {"cost": {"tool_calls_cost": 0.001, "total_cost": 0.00172, "…": "…"}}}}
```

- `detail.usage_raw` is the full usage report from Perplexity. The web-search part (`tool_calls_cost`) is often larger than the
  token cost.
- The hook only sees direct calls to Perplexity. With `PERPLEXITY_PROXY` set, the official server takes another path and no usage
  is recorded.
- Turn logging off with `USAGE_LOG=false`.

## Configuration reference

All settings live in `.env`. Each one is also explained in [.env.example](.env.example). After a change, run `docker compose up -d`.

| Variable | Default | Meaning |
|---|---|---|
| `PERPLEXITY_API_KEY` | (required) | Your Perplexity API key. The server does not start without it |
| `PERPLEXITY_TIMEOUT_MS` | `300000` | Longest wait for Perplexity (ms). Raise it for very broad research topics |
| `PERPLEXITY_BASE_URL` | `https://api.perplexity.ai` | Change it to go through a company gateway |
| `PERPLEXITY_PROXY` | (empty) | Proxy for internet access. Empty = use `HTTPS_PROXY` / `HTTP_PROXY` if set |
| `PERPLEXITY_LOG_LEVEL` | `ERROR` | `DEBUG`, `INFO`, `WARN` or `ERROR` |
| `BIND_ADDRESS` | `127.0.0.1` | Must be `0.0.0.0` in Docker (the example sets it) |
| `ALLOWED_HOSTS` | (see example) | Every `host:port` used to reach the server, comma-separated, exact match. Others get HTTP 421 |
| `ALLOWED_ORIGINS` | (empty) | Page addresses of browser-based clients allowed to call across origins |
| `PORT` | `8080` | Port inside the container. If you change it, also change `docker-compose.yml` and `ALLOWED_HOSTS` |
| `ENABLE_PERPLEXITY_SEARCH` | `true` | Offer `perplexity_search` |
| `ENABLE_PERPLEXITY_ASK` | `true` (`false` in the example) | Offer `perplexity_ask` |
| `ENABLE_PERPLEXITY_REASON` | `true` (`false` in the example) | Offer `perplexity_reason` |
| `ENABLE_PERPLEXITY_RESEARCH` | `true` (`false` in the example) | Offer `perplexity_research` |
| `USAGE_LOG` | `true` | Keep the usage log |
| `USAGE_DIR` | `/app/usage` | Folder of the usage log |
| `USAGE_PORT` | `8081` | Port of `GET /usage` and the switch health check (`0` = off). Not published outside Docker |
| `USAGE_TOKEN` | (empty) | When set, `GET /usage` requires `Authorization: Bearer <token>` |
| `DOCKER_NETWORK` | `agent_network` | Docker network shared with your agents |
| `PUBLISH_ADDR` | `0.0.0.0` | `0.0.0.0` = other machines can connect, `127.0.0.1` = this machine only |
| `PUBLISH_PORT` | `8803` | Port on your machine. If you change it, update `ALLOWED_HOSTS` |

## Security

- **The MCP endpoint has no login.** Anyone who can reach the port can spend your Perplexity balance. The default
  (`PUBLISH_ADDR=0.0.0.0`) lets other machines connect. If you don't need that, set `PUBLISH_ADDR=127.0.0.1`; agents on the
  docker network still work.
- **Set a spending limit** for the key at [console.perplexity.ai](https://console.perplexity.ai) to cap the damage of misuse.
- `ALLOWED_HOSTS` blocks DNS-rebinding attacks from web browsers. List only the names you really use. It does not stop direct
  calls from your network.
- **Never commit `.env`.** It is in `.gitignore`. The key stays in the container; agents never see it.
- The usage port (8081) is not published outside Docker and holds no questions or answers. Set `USAGE_TOKEN` to require a token.
- The container runs as a non-root user.
- Search results and answers come from the open web. Tell your agent to treat them as information, not as instructions.

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| `network agent_network declared as external, but could not be found` | Run `docker network create agent_network`, or set `DOCKER_NETWORK` to an existing network |
| `port is already allocated` | Another program uses 8803. Set `PUBLISH_PORT` to a free port and update `ALLOWED_HOSTS` |
| The container stops; the log says `PERPLEXITY_API_KEY environment variable is required` | Put the key in `.env`, then `docker compose up -d` |
| HTTP 421 `Misdirected request` | The `host:port` in the URL is not in `ALLOWED_HOSTS`. Add it exactly, then `docker compose up -d` |
| `Perplexity API error: 401 Unauthorized` | The key is wrong or was revoked. Create a new one at console.perplexity.ai |
| The client reports a timeout during research | Raise the client timeout (600 s or more) and, if needed, `PERPLEXITY_TIMEOUT_MS` |
| `Tool perplexity_ask disabled` or `not found` | The tool is switched off. Set its `ENABLE_…` line to `true`, run `docker compose up -d`, reconnect the client |
| A tool is missing in the client | Check `GET :8081/health`, then reconnect the client |
| A browser-based client is refused | Add the page address to `ALLOWED_ORIGINS` |
| `/usage` has no records | `PERPLEXITY_PROXY` is set (the hook cannot see those calls), or `USAGE_LOG=false` |

See the server's own log with `docker compose logs -f`. Set `PERPLEXITY_LOG_LEVEL=DEBUG` for more detail.

## Development

The official server is used as it is. This project's own code is two hook files loaded before it with `node --import`.

| File | Contents |
|---|---|
| `Dockerfile` | Builds from the `node` image, installs the server from `package-lock.json`, loads both hooks, runs as a non-root user |
| `tools-hook.mjs` | Switches each tool on or off from `ENABLE_PERPLEXITY_*` (wraps `McpServer.registerTool` of the MCP SDK and disables a tool right after it is registered) |
| `usage-hook.mjs` | Logs tokens, time and cost of every Perplexity call; serves `GET /usage` and `GET /health` on port 8081 |
| `tests/` | Tests `tools-hook.mjs` against the real server and `usage-hook.mjs` against a fake Perplexity (free) |
| `docker-compose.yml` | Port, docker network, usage volume, settings from `.env` |
| `package.json`, `package-lock.json` | Pin the server version and every library |

Run the tests (no Node.js needed on your machine):

```bash
docker run --rm -v "$PWD:/w" -w /w node:22.23.3-alpine3.24 sh -c "npm ci && npm test"
```

### Updating the Perplexity MCP server

```bash
docker run --rm -v "$PWD:/w" -w /w node:22.23.3-alpine3.24 sh -c "npm install --package-lock-only --no-audit --no-fund @perplexity-ai/mcp-server@<new-version>"
```

```bash
docker compose up -d --build
```

Run the tests, then commit the changed `package.json` and `package-lock.json`. In PowerShell, write `${PWD}` instead of `$PWD`.

## License

[MIT](LICENSE) © 2026 Chacharin Lertyosbordin.
The Perplexity MCP server is © Perplexity AI under the MIT license ([source](https://github.com/perplexityai/modelcontextprotocol)).
Perplexity is a trademark of its owner. This project is not affiliated with Perplexity AI.
