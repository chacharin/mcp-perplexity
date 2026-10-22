# mcp-perplexity - the official Perplexity MCP server (@perplexity-ai/mcp-server) in streamable HTTP mode
# https://www.npmjs.com/package/@perplexity-ai/mcp-server
FROM node:22.23.3-alpine3.24
WORKDIR /app

# exact versions from package-lock.json; the npm cache is removed in the same layer so it never ships
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# loaded before the server with --import:
#   tools-hook.mjs  switches each tool on or off from .env (ENABLE_PERPLEXITY_SEARCH / _ASK / _REASON / _RESEARCH)
#   usage-hook.mjs  logs the token usage of every Perplexity call (the server itself drops it) to /app/usage,
#                   served on port 8081 (GET /usage, GET /health)
COPY tools-hook.mjs usage-hook.mjs ./
RUN addgroup -g 10001 appuser && adduser -D -u 10001 -G appuser appuser && mkdir -p /app/usage && chown appuser /app/usage
USER appuser
EXPOSE 8080 8081
CMD ["node", "--import", "./tools-hook.mjs", "--import", "./usage-hook.mjs", "node_modules/@perplexity-ai/mcp-server/dist/http.js"]
