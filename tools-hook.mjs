// tools-hook.mjs - switch each tool of the official Perplexity MCP server on or off from .env,
// loaded with `node --import ./tools-hook.mjs` before the server.
//
//   ENABLE_PERPLEXITY_SEARCH=true    ENABLE_PERPLEXITY_ASK=true
//   ENABLE_PERPLEXITY_REASON=true    ENABLE_PERPLEXITY_RESEARCH=true
//
// The server registers every tool with McpServer.registerTool of the MCP SDK; a tool that is switched off is
// disabled right after it is registered, so it is left out of tools/list (agents never see it, and its
// description costs no tokens) and a direct tools/call of it is refused. Unset = true, so nothing changes
// unless a switch is set. Accepts true/false, 1/0, yes/no, on/off in any case.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const TOOLS = ["perplexity_search", "perplexity_ask", "perplexity_reason", "perplexity_research"];
const envName = (tool) => `ENABLE_${tool.toUpperCase()}`;
const TRUE = ["true", "1", "yes", "on"];
const FALSE = ["false", "0", "no", "off"];

/** {tool: true|false} from the environment, plus the settings that could not be read. */
export function readSwitches(env = process.env) {
  const enabled = {};
  const problems = [];
  for (const tool of TOOLS) {
    const name = envName(tool);
    const raw = (env[name] ?? "").trim().toLowerCase();
    if (raw === "" || TRUE.includes(raw)) enabled[tool] = true;
    else if (FALSE.includes(raw)) enabled[tool] = false;
    else {
      enabled[tool] = true;
      problems.push(`${name}=${env[name]} is not true or false - the tool stays on`);
    }
  }
  if (!Object.values(enabled).some(Boolean)) problems.push("every ENABLE_PERPLEXITY_* is false - the server offers no tool");
  return { enabled, problems };
}

export const switches = readSwitches();
export const disabledSeen = new Set();
for (const p of switches.problems) console.error(`[tools-hook] WARNING: ${p}`);
const off = TOOLS.filter((t) => !switches.enabled[t]);
if (off.length) console.error(`[tools-hook] switched off: ${off.join(", ")}`);

const register = McpServer.prototype.registerTool;
McpServer.prototype.registerTool = function registerToolWithSwitch(name, ...rest) {
  const tool = register.call(this, name, ...rest);
  if (switches.enabled[name] === false) {
    tool.disable();
    disabledSeen.add(name);
  }
  return tool;
};
