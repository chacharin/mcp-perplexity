# mcp-perplexity - the official Perplexity MCP server (@perplexity-ai/mcp-server) in streamable HTTP mode
# https://www.npmjs.com/package/@perplexity-ai/mcp-server
FROM node:22.23.3-alpine3.24
WORKDIR /app

# exact versions from package-lock.json; the npm cache is removed in the same layer so it never ships
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

RUN addgroup -g 10001 appuser && adduser -D -u 10001 -G appuser appuser
USER appuser
EXPOSE 8080
CMD ["node", "node_modules/@perplexity-ai/mcp-server/dist/http.js"]
