# mcp-perplexity

[English](README.md) | **ภาษาไทย**

ชุด Docker พร้อมใช้ของ [Perplexity MCP server ฉบับทางการ](https://www.npmjs.com/package/@perplexity-ai/mcp-server)
ที่ให้เอเจนต์และผู้ช่วย AI **ค้นหาเว็บ** **ถามตอบพร้อมแหล่งอ้างอิง** **วิเคราะห์เป็นขั้นตอน** และ **ค้นคว้าเชิงลึก**
โดยใช้ [Perplexity](https://www.perplexity.ai)

ใช้ได้กับ [MCP](https://modelcontextprotocol.io) client ทุกตัวที่รองรับ streamable HTTP เช่น Claude Code, Claude Desktop,
VS Code, Cursor หรือเอเจนต์ที่คุณเขียนเอง API key ของ Perplexity เก็บอยู่ใน container เท่านั้น และทุกการเรียกจะถูกบันทึก token
เวลา และค่าใช้จ่ายไว้ จึงรู้เสมอว่าเอเจนต์ใช้เงินไปเท่าไร ไม่ต้องติดตั้ง Node.js บนเครื่อง

> โปรเจกต์นี้จัดเตรียม Perplexity MCP server ฉบับทางการให้พร้อมใช้ ไม่ได้เขียน server ขึ้นใหม่ ตัว server พัฒนาโดย Perplexity AI
> ภายใต้สัญญาอนุญาต MIT และโปรเจกต์นี้ไม่ใช่ผลงานทางการของ Perplexity

- [ได้อะไรบ้าง](#ได้อะไรบ้าง)
- [เครื่องมือ](#เครื่องมือ)
- [การทำงาน](#การทำงาน)
- [เริ่มใช้งานด้วย Docker](#เริ่มใช้งานด้วย-docker)
- [รันโดยไม่ใช้ Docker](#รันโดยไม่ใช้-docker)
- [เชื่อมกับ MCP client](#เชื่อมกับ-mcp-client)
- [เรียกโดยตรง (JSON)](#เรียกโดยตรง-json)
- [เปิด/ปิดเครื่องมือทีละตัว](#เปิดปิดเครื่องมือทีละตัว)
- [ข้อมูลการใช้งานและค่าใช้จ่าย](#ข้อมูลการใช้งานและค่าใช้จ่าย)
- [การตั้งค่าทั้งหมด](#การตั้งค่าทั้งหมด)
- [ความปลอดภัย](#ความปลอดภัย)
- [แก้ปัญหา](#แก้ปัญหา)
- [พัฒนาต่อ](#พัฒนาต่อ)

## ได้อะไรบ้าง

- **เครื่องมือ 4 ระดับ ตั้งแต่ถูกจนถึงละเอียด** ผลค้นหาดิบ คำตอบเร็ว คำตอบที่วิเคราะห์เป็นขั้นตอน และรายงานค้นคว้าฉบับเต็ม
  เลือกความลึกให้เหมาะกับแต่ละงาน
- **คำตอบมีแหล่งอ้างอิง** เครื่องมือถามตอบส่งข้อความที่มีเลขอ้างอิง เช่น `[2][3]` พร้อมรายการ URL ของแหล่งข้อมูล
- **เปิดเฉพาะเครื่องมือที่ต้องการ** แต่ละเครื่องมือมีสวิตช์ของตัวเองใน `.env` ไฟล์ตัวอย่างเปิดเฉพาะ `perplexity_search` ซึ่งเร็วและถูกที่สุด
  เครื่องมือที่ปิดจะหายไปจากรายการเครื่องมือของ client
- **บันทึก token เวลา และค่าใช้จ่าย** Perplexity รายงาน token และค่าใช้จ่ายมากับทุกคำตอบ แต่ server ทางการไม่ได้เก็บไว้
  โปรเจกต์นี้จึงบันทึกให้ หนึ่งบรรทัด JSON ต่อการเรียก อ่านได้ที่ `GET /usage` มีแต่ตัวเลข ไม่มีคำถามหรือคำตอบ
- **ใช้ server ทางการโดยไม่แก้ไข** มีเพียงไฟล์ hook เล็ก ๆ 2 ไฟล์ที่โหลดก่อนด้วย `node --import` การอัปเดตเป็นรุ่นใหม่ของ Perplexity
  จึงเปลี่ยนแค่หมายเลขเวอร์ชันเดียว
- **ล็อกไลบรารีทุกตัว** `package-lock.json` ระบุเวอร์ชันของ server และไลบรารีทั้งหมด ทุกการ build จึงได้ชุดเดียวกัน

## เครื่องมือ

| เครื่องมือ | ทำอะไร | Perplexity API | ความเร็วและค่าใช้จ่าย | เปิดใน `.env.example` |
|---|---|---|---|---|
| `perplexity_search` | ค้นหาเว็บและส่งผลตามต้นฉบับ ได้แก่ ชื่อหน้า URL ข้อความที่ดึงจากหน้า และวันที่ ไม่มี AI สรุป | Search API | เร็ว ถูกที่สุด | เปิด |
| `perplexity_ask` | ตอบคำถามจากข้อมูลบนเว็บ พร้อมแหล่งอ้างอิง | Agent API preset `fast` | เร็ว | ปิด |
| `perplexity_reason` | คิดเป็นขั้นตอน (เปรียบเทียบ คำนวณ อธิบายเหตุผล) โดยอ้างอิงข้อมูลจากเว็บ | Agent API preset `medium` | ปานกลาง | ปิด |
| `perplexity_research` | ค้นคว้าจากหลายแหล่งแล้วเขียนเป็นรายงานพร้อมแหล่งอ้างอิง | Agent API preset `high` | ช้า (อาจหลายนาที) แพงที่สุด | ปิด |

ทุกเครื่องมือเป็นแบบอ่านอย่างเดียว ทุกการเรียกคิดค่าใช้จ่ายกับ `PERPLEXITY_API_KEY` ของคุณ ดูราคาปัจจุบันได้ที่
[หน้าราคาของ Perplexity](https://docs.perplexity.ai/getting-started/pricing)

ผู้ใช้ไม่ต้องเรียกเครื่องมือเอง เพียงสั่งเอเจนต์ด้วยภาษาปกติ เอเจนต์จะเลือกเครื่องมือและกรอกค่าให้ หากต้องการกำหนดให้ระบุในคำสั่ง
เช่น *"ค้นเว็บแบบเร็ว"* หรือ *"ค้นคว้าเชิงลึกเรื่อง…"* เพราะแต่ละเครื่องมือใช้เวลาและค่าใช้จ่ายต่างกันมาก

### `perplexity_search`

ตัวอย่างคำสั่งถึงเอเจนต์: *"หาลิงก์ GitHub ของ LightRAG"*, *"ข่าวนโยบาย AI ของไทยสัปดาห์นี้ ขอเฉพาะเว็บ .go.th"*

| พารามิเตอร์ | จำเป็น | ความหมาย |
|---|---|---|
| `query` | ✓ | คำค้น |
| `max_results` | | จำนวนผลลัพธ์ 1–20 (ค่าเริ่มต้น 10) |
| `max_tokens_per_page` | | จำนวน token สูงสุดที่ดึงจากแต่ละหน้า (ค่าเริ่มต้น 1024) |
| `country` | | รหัสประเทศ 2 ตัวอักษรตาม ISO 3166-1 เช่น `TH` เพื่อให้ได้ผลของประเทศนั้น |
| `search_recency_filter` | | `hour` `day` `week` `month` หรือ `year` |
| `search_domain_filter` | | จำกัดโดเมน เช่น `["wikipedia.org"]` หรือตัดโดเมนออกด้วย `-` เช่น `["-reddit.com"]` |
| `search_type` | | `web` (ค่าเริ่มต้น) หรือ `fast` (เร็วและถูกกว่า) |

เหมาะกับงานที่ต้องการแหล่งข้อมูลต้นฉบับ หรือให้เอเจนต์อ่านและสรุปเอง

### `perplexity_ask` และ `perplexity_reason`

ตัวอย่างคำสั่ง: *"LightRAG คืออะไร ตอบสั้น ๆ"*, *"เปรียบเทียบการใช้พลังงานของศูนย์ข้อมูลใน 3 ภูมิภาคที่ใหญ่ที่สุด"*

| พารามิเตอร์ | จำเป็น | ความหมาย |
|---|---|---|
| `messages` | ✓ | บทสนทนา เป็นรายการของ `{role, content}` โดย role คือ `system`, `user` หรือ `assistant` |
| `search_recency_filter` | | `hour` `day` `week` `month` หรือ `year` |
| `search_domain_filter` | | เหมือนใน `perplexity_search` |
| `search_context_size` | | ปริมาณข้อมูลจากเว็บที่ใช้ตอบ: `low` (เร็วที่สุด) `medium` `high` (ครอบคลุมที่สุด) |

คำตอบเป็นข้อความที่มีเลขอ้างอิง เช่น `[2][3]` และมีรายการ URL ของแหล่งข้อมูลอยู่ท้ายคำตอบ

### `perplexity_research`

ตัวอย่างคำสั่ง: *"ค้นคว้าเชิงลึกเรื่องการใช้ RAG ในหน่วยงานรัฐ แล้วเขียนเป็นรายงาน"*

รับเฉพาะ `messages` อาจทำงานหลายนาทีและแพงที่สุด จึงควรใช้เมื่อต้องการรายงานที่รวบรวมจากหลายแหล่งจริง ๆ
และต้องตั้ง timeout ของ client ให้นานพอ (ดู[เชื่อมกับ MCP client](#เชื่อมกับ-mcp-client))

## การทำงาน

```
MCP client / เอเจนต์ ──POST /mcp──▶ mcp-perplexity (container พอร์ต 8080)
                                      ① ตรวจ Host header กับ ALLOWED_HOSTS (ถ้าไม่อยู่ในรายชื่อตอบ HTTP 421)
                                      ② tools-hook.mjs ถอดเครื่องมือที่ปิดไว้ออกแล้ว
                                      ③ เครื่องมือเรียก https://api.perplexity.ai ด้วย PERPLEXITY_API_KEY
                                      ④ usage-hook.mjs อ่านสำเนาคำตอบแล้วบันทึก token เวลา และค่าใช้จ่าย
                    ◀── ส่งคำตอบกลับไปที่ client โดยไม่แก้ไข

usage/*.jsonl ──GET /usage (พอร์ต 8081 เฉพาะใน docker network)──▶ ตารางคำนวณ แดชบอร์ด หรืองานวิจัย
```

server ไม่เก็บสถานะและไม่มีฐานข้อมูล volume เดียวที่มีคือบันทึกการใช้งาน

## เริ่มใช้งานด้วย Docker

ต้องมี [Docker](https://docs.docker.com/get-docker/) พร้อม Docker Compose อินเทอร์เน็ตตอน build ครั้งแรก
(เพื่อดาวน์โหลด image ของ Node และแพ็กเกจจาก npm) และ API key ของ Perplexity จาก [console.perplexity.ai](https://console.perplexity.ai)

**1. ดาวน์โหลดโค้ด**

```bash
git clone https://github.com/chacharin/mcp-perplexity.git
```

```bash
cd mcp-perplexity
```

**2. สร้าง docker network** (ครั้งเดียวต่อเครื่อง) container ที่อยู่ใน network นี้ เช่น เอเจนต์ที่รันใน Docker จะเรียก server ด้วยชื่อได้
ถ้ามี network นี้อยู่แล้วข้ามขั้นนี้ได้

```bash
docker network create agent_network
```

**3. สร้าง `.env` แล้วใส่ key**

```bash
cp .env.example .env
```

เปิด `.env` แล้วแทนค่าตัวอย่างของ `PERPLEXITY_API_KEY` ด้วย key ของคุณ ไฟล์นี้เปิดเฉพาะ `perplexity_search`
ถ้าต้องการใช้เครื่องมืออื่นให้เปลี่ยนบรรทัด `ENABLE_PERPLEXITY_…` ของเครื่องมือนั้นเป็น `true` (ดู[เปิด/ปิดเครื่องมือทีละตัว](#เปิดปิดเครื่องมือทีละตัว))

**4. เริ่ม server**

```bash
docker compose up -d --build
```

**5. ตรวจสอบ**

```bash
curl http://127.0.0.1:8803/health
```

`{"status":"ok", …}` หมายถึง server ทำงานแล้ว แต่ยังไม่ได้ตรวจ key ถ้า key ผิดจะเห็น `401 Unauthorized` ตอนเรียกเครื่องมือครั้งแรก

ตอนนี้ MCP endpoint คือ `http://localhost:8803/mcp` บนเครื่องนี้ และ `http://mcp-perplexity:8080/mcp` จาก container อื่นใน `agent_network`

เมื่อแก้ `.env` ให้สั่ง `docker compose up -d` อีกครั้ง (ไม่ต้อง build ใหม่) หยุด server ด้วย `docker compose down`
บันทึกการใช้งานยังเก็บอยู่ใน volume `usage`

## รันโดยไม่ใช้ Docker

ต้องมี Node.js 22 ขึ้นไป

```bash
npm ci --omit=dev
```

เพิ่มบรรทัดเหล่านี้ใน `.env` เพื่อให้ server ฟังที่พอร์ต 8803 เฉพาะเครื่องนี้ และเก็บบันทึกไว้ในโฟลเดอร์โปรเจกต์

```
BIND_ADDRESS=127.0.0.1
PORT=8803
ALLOWED_HOSTS=localhost:8803,127.0.0.1:8803
USAGE_DIR=./usage
```

```bash
node --env-file=.env --import ./tools-hook.mjs --import ./usage-hook.mjs node_modules/@perplexity-ai/mcp-server/dist/http.js
```

จากนั้นข้อมูลการใช้งานอยู่ที่ `http://127.0.0.1:8081/health` และ `http://127.0.0.1:8081/usage`

## เชื่อมกับ MCP client

server ใช้ **streamable HTTP** ให้ใช้ URL ที่ client เข้าถึงได้

| client อยู่ที่ไหน | URL | ต้องมีใน `ALLOWED_HOSTS` |
|---|---|---|
| เครื่องเดียวกัน | `http://localhost:8803/mcp` | `localhost:8803` (มีในไฟล์ตัวอย่างแล้ว) |
| container อื่นใน `agent_network` | `http://mcp-perplexity:8080/mcp` | `mcp-perplexity:8080` (มีในไฟล์ตัวอย่างแล้ว) |
| เครื่องอื่นในเครือข่าย | `http://<ip-ของ-server>:8803/mcp` | `<ip-ของ-server>:8803` (ต้องเพิ่มเอง ดู[ความปลอดภัย](#ความปลอดภัย)) |

**ตั้ง timeout ให้นาน** `perplexity_research` อาจใช้เวลาหลายนาที ถ้า client เลิกรอก่อน client จะแจ้งว่าล้มเหลว
ทั้งที่ Perplexity ยังทำงานอยู่และยังคิดเงิน ค่าที่ปลอดภัยคือ 600 วินาที

**Claude Code**

```bash
claude mcp add --transport http perplexity http://localhost:8803/mcp
```

**Claude Desktop** (`claude_desktop_config.json` ผ่านตัวเชื่อม [mcp-remote](https://www.npmjs.com/package/mcp-remote) ต้องมี Node.js)

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

**client อื่น ๆ** ใช้ URL ข้างบนกับ transport แบบ streamable HTTP ถ้า client ทำงานอยู่ในหน้าเว็บ (หรือ MCP Inspector แบบ *Direct*)
ต้องใส่ที่อยู่ของหน้านั้นใน `ALLOWED_ORIGINS` ด้วย

**ทดลองโดยไม่ต้องมีเอเจนต์** ใช้ [MCP Inspector](https://github.com/modelcontextprotocol/inspector) (ต้องมี Node.js)

```bash
npx @modelcontextprotocol/inspector
```

ในหน้าที่เปิดขึ้น เลือก Transport = *Streamable HTTP*, URL = `http://localhost:8803/mcp`, Connection type = *Via Proxy*
กด *Connect* แล้วเปิดแท็บ *Tools* และสั่ง `perplexity_search`

**คำแนะนำสำหรับคำสั่งของเอเจนต์** บอกเอเจนต์ว่าควรใช้เครื่องมือไหนเมื่อไร เช่น *"ใช้ perplexity_search หาข้อเท็จจริงและแหล่งข้อมูล
ใช้ perplexity_research เฉพาะเมื่อขอรายงาน และอ้างอิง URL ทุกแหล่งที่ใช้"*

## เรียกโดยตรง (JSON)

server มี route ดังนี้

| Route | พอร์ต | ใช้ทำอะไร |
|---|---|---|
| `POST /mcp` | 8080 (เปิดออกเป็น 8803) | เรียกเครื่องมือทั้งหมดตามมาตรฐาน MCP (JSON-RPC 2.0) |
| `GET /health` | 8080 (เปิดออกเป็น 8803) | server ทำงานอยู่หรือไม่ ไม่ตรวจ key และไม่เสียเงิน |
| `GET /health` | 8081 (เฉพาะ docker network) | เครื่องมือใดเปิดอยู่ ค่าตั้งที่อ่านไม่ได้ และสถานะบันทึกการใช้งาน |
| `GET /usage` | 8081 (เฉพาะ docker network) | token เวลา และค่าใช้จ่ายของการเรียก Perplexity ทุกครั้ง |

ทุกคำขอไปที่ `/mcp` ต้องมี header 2 ตัวนี้ และ Host ที่ใช้เรียกต้องอยู่ใน `ALLOWED_HOSTS`

```
Content-Type: application/json
Accept: application/json, text/event-stream
```

server ตอบเป็น JSON ธรรมดา ข้อความของแต่ละเครื่องมืออยู่ที่ `result.content[0].text` และซ้ำอีกครั้งใน `result.structuredContent`
(คีย์ `results` สำหรับ `perplexity_search` และ `response` สำหรับเครื่องมืออื่น)

**ดูรายการเครื่องมือ** (ไม่เสียเงิน)

```json
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
```

จะแสดงเฉพาะเครื่องมือที่เปิดอยู่

**ค้นหา**

```json
{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
  "name": "perplexity_search",
  "arguments": {"query": "LightRAG HKUDS GitHub", "max_results": 2}
}}
```

ผลลัพธ์ (ย่อ):

```json
{"jsonrpc": "2.0", "id": 2, "result": {
  "content": [{"type": "text",
    "text": "Found 2 search results:\n\n1. **[EMNLP2025] LightRAG: Simple and Fast Retrieval- ...**\n   URL: https://github.com/hkuds/lightrag\n   GitHub - HKUDS/LightRAG: … LightRAG is a lightweight knowledge-graph RAG framework …\n   Date: …\n\n2. …"}],
  "structuredContent": {"results": "Found 2 search results: …"}
}}
```

**ถามคำถาม** (`perplexity_ask`, `perplexity_reason` และ `perplexity_research` รับคำขอรูปแบบเดียวกัน)

```json
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {
  "name": "perplexity_ask",
  "arguments": {
    "messages": [{"role": "user", "content": "LightRAG คืออะไร ตอบสั้น ๆ 2 ประโยค"}],
    "search_context_size": "low"
  }
}}
```

ผลลัพธ์ (ย่อ):

```json
{"jsonrpc": "2.0", "id": 3, "result": {
  "content": [{"type": "text",
    "text": "LightRAG คือเฟรมเวิร์ก RAG ที่สร้างกราฟความรู้จากเอกสาร แล้วผสานการค้นหาด้วยกราฟและเวกเตอร์ …[2][3]\n\nCitations:\n[1] …\n[2] https://arxiv.org/html/2410.05779v1\n[3] https://github.com/hkuds/lightrag"}],
  "structuredContent": {"response": "LightRAG คือเฟรมเวิร์ก RAG … Citations: …"}
}}
```

**ด้วย curl** (คำสั่งนี้เรียก Perplexity จริงและเสียเงิน ถ้าต้องการทดสอบฟรีให้ใช้ `"method":"tools/list"` และลบ `params` ออก)

```bash
curl http://127.0.0.1:8803/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"perplexity_search","arguments":{"query":"LightRAG HKUDS GitHub","max_results":2}}}'
```

บน Windows คำสั่ง curl อาจเปลี่ยนภาษาไทยที่พิมพ์ในบรรทัดคำสั่งเป็น `?` ให้บันทึกคำขอเป็นไฟล์ UTF-8 เช่น `request.json`
แล้วส่งด้วย `-d @request.json`

## เปิด/ปิดเครื่องมือทีละตัว

แต่ละเครื่องมือมีบรรทัดของตัวเองใน `.env` รับค่า `true`/`false`, `1`/`0`, `yes`/`no` และ `on`/`off` ไฟล์ตัวอย่างตั้งไว้ดังนี้

```
ENABLE_PERPLEXITY_SEARCH=true
ENABLE_PERPLEXITY_ASK=false
ENABLE_PERPLEXITY_REASON=false
ENABLE_PERPLEXITY_RESEARCH=false
```

- เครื่องมือที่ปิด**ไม่อยู่ในรายการเครื่องมือ** เอเจนต์จึงไม่เห็น ไม่เสีย token ค่าคำอธิบาย และถ้าเรียกตรง ๆ จะถูกปฏิเสธ ใช้ได้เหมือนกันทุก client
- บรรทัดที่ไม่มีใน `.env` ถือว่าเป็น `true` ระบบที่ติดตั้งก่อนมีสวิตช์เหล่านี้จึงยังมีครบทั้ง 4 เครื่องมือ
- ค่าที่อ่านไม่ได้ เช่น `maybe` จะคงเครื่องมือนั้นเปิดไว้ และแจ้งใน log กับ `GET :8081/health`
- เมื่อเปลี่ยนแล้วสั่ง `docker compose up -d` จากนั้นเชื่อมต่อ client ใหม่หรือรีสตาร์ต client เพราะ client อ่านรายการเครื่องมือตอนเชื่อมต่อ

ตรวจสวิตช์ได้ที่ `http://mcp-perplexity:8081/health` (จากใน docker network)

```json
{"ok": true, "tools": {"perplexity_search": true, "perplexity_ask": false, "…": "…"}, "problems": [], "…": "…"}
```

## ข้อมูลการใช้งานและค่าใช้จ่าย

บันทึกเป็น JSON Lines ใน volume `usage` วันละไฟล์ (`usage-YYYY-MM-DD.jsonl`) ตาม schema `harness-usage/1`
มี**แต่ตัวเลข** ไม่มีคำถาม คำตอบ หรือคำค้น

อ่านได้จาก container ที่อยู่ใน docker network เช่น

```bash
docker run --rm --network agent_network curlimages/curl -s http://mcp-perplexity:8081/usage
```

| พารามิเตอร์ | ความหมาย |
|---|---|
| `since`, `until` | ช่วงเวลาเป็นวินาทีแบบ Unix ถ้าไม่ระบุจะส่งทั้งหมด |
| `limit` | จำนวนระเบียนสูงสุด ค่าเริ่มต้น 50,000 (เก็บรายการล่าสุดไว้) |

| `kind` | บันทึกเมื่อเรียก | ข้อมูลหลัก |
|---|---|---|
| `search_call` | `perplexity_search` | `duration_s`, `status`, จำนวนผลลัพธ์ (Search API ไม่รายงาน token) |
| `llm_call` | เครื่องมืออีก 3 ตัว | `model`, `duration_s`, `ttfb_s`, `input_tokens`, `output_tokens`, `reasoning_tokens`, `cache_read_tokens`, `cache_write_tokens`, `cost_usd`, `detail.preset`, `detail.search_queries`, `detail.usage_raw` |

ตัวอย่างระเบียน (ย่อ) หลังเรียก `perplexity_ask` หนึ่งครั้ง

```json
{"kind": "llm_call", "tool": "perplexity_ask", "model": "openai/gpt-6-luna", "provider": "perplexity",
 "duration_s": 2.342, "ttfb_s": 0.803, "input_tokens": 3, "cache_write_tokens": 5705, "output_tokens": 16,
 "total_tokens": 5724, "cost_usd": 0.00172, "status": "ok",
 "detail": {"endpoint": "v1/agent", "preset": "fast", "search_queries": 1, "search_results": 5,
            "usage_raw": {"cost": {"tool_calls_cost": 0.001, "total_cost": 0.00172, "…": "…"}}}}
```

- `detail.usage_raw` คือรายงานการใช้งานฉบับเต็มจาก Perplexity ค่าค้นเว็บ (`tool_calls_cost`) มักสูงกว่าค่า token
- hook เห็นเฉพาะการเรียก Perplexity โดยตรง ถ้าตั้ง `PERPLEXITY_PROXY` ไว้ server ทางการจะใช้ช่องทางอื่น จึงไม่มีบันทึกการใช้งาน
- ปิดการบันทึกได้ด้วย `USAGE_LOG=false`

## การตั้งค่าทั้งหมด

ค่าทั้งหมดอยู่ใน `.env` และมีคำอธิบายใน [.env.example](.env.example) ด้วย เมื่อแก้แล้วสั่ง `docker compose up -d`

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `PERPLEXITY_API_KEY` | (จำเป็น) | API key ของ Perplexity ถ้าไม่มี server จะไม่เริ่มทำงาน |
| `PERPLEXITY_TIMEOUT_MS` | `300000` | เวลารอ Perplexity สูงสุด (มิลลิวินาที) เพิ่มเมื่อค้นคว้าหัวข้อที่กว้างมาก |
| `PERPLEXITY_BASE_URL` | `https://api.perplexity.ai` | เปลี่ยนเมื่อต้องเรียกผ่าน gateway ขององค์กร |
| `PERPLEXITY_PROXY` | (ว่าง) | proxy สำหรับออกอินเทอร์เน็ต ว่าง = ใช้ `HTTPS_PROXY` / `HTTP_PROXY` ถ้ามี |
| `PERPLEXITY_LOG_LEVEL` | `ERROR` | `DEBUG`, `INFO`, `WARN` หรือ `ERROR` |
| `BIND_ADDRESS` | `127.0.0.1` | ใน Docker ต้องเป็น `0.0.0.0` (ไฟล์ตัวอย่างตั้งไว้แล้ว) |
| `ALLOWED_HOSTS` | (ดูไฟล์ตัวอย่าง) | ทุก `host:port` ที่ใช้เรียก server คั่นด้วย `,` ต้องตรงทุกตัวอักษร ที่ไม่อยู่ในรายชื่อจะได้ HTTP 421 |
| `ALLOWED_ORIGINS` | (ว่าง) | ที่อยู่หน้าเว็บของ client แบบเบราว์เซอร์ที่อนุญาตให้เรียกข้ามโดเมน |
| `PORT` | `8080` | พอร์ตภายใน container ถ้าเปลี่ยนต้องแก้ `docker-compose.yml` และ `ALLOWED_HOSTS` ด้วย |
| `ENABLE_PERPLEXITY_SEARCH` | `true` | เปิดให้ใช้ `perplexity_search` |
| `ENABLE_PERPLEXITY_ASK` | `true` (ไฟล์ตัวอย่าง `false`) | เปิดให้ใช้ `perplexity_ask` |
| `ENABLE_PERPLEXITY_REASON` | `true` (ไฟล์ตัวอย่าง `false`) | เปิดให้ใช้ `perplexity_reason` |
| `ENABLE_PERPLEXITY_RESEARCH` | `true` (ไฟล์ตัวอย่าง `false`) | เปิดให้ใช้ `perplexity_research` |
| `USAGE_LOG` | `true` | เก็บบันทึกการใช้งาน |
| `USAGE_DIR` | `/app/usage` | โฟลเดอร์ของบันทึกการใช้งาน |
| `USAGE_PORT` | `8081` | พอร์ตของ `GET /usage` และการตรวจสวิตช์ (`0` = ปิด) ไม่เปิดออกนอก Docker |
| `USAGE_TOKEN` | (ว่าง) | เมื่อกำหนด `GET /usage` ต้องมี `Authorization: Bearer <token>` |
| `DOCKER_NETWORK` | `agent_network` | docker network ที่ใช้ร่วมกับเอเจนต์ |
| `PUBLISH_ADDR` | `0.0.0.0` | `0.0.0.0` = เครื่องอื่นเชื่อมต่อได้, `127.0.0.1` = เฉพาะเครื่องนี้ |
| `PUBLISH_PORT` | `8803` | พอร์ตบนเครื่อง ถ้าเปลี่ยนต้องแก้ `ALLOWED_HOSTS` ด้วย |

## ความปลอดภัย

- **MCP endpoint ไม่มีการยืนยันตัวตน** ใครที่เข้าถึงพอร์ตได้ก็ใช้ยอดเงิน Perplexity ของคุณได้ ค่าเริ่มต้น (`PUBLISH_ADDR=0.0.0.0`)
  เปิดให้เครื่องอื่นเชื่อมต่อได้ ถ้าไม่จำเป็นให้ตั้ง `PUBLISH_ADDR=127.0.0.1` เอเจนต์ใน docker network ยังใช้ได้ตามปกติ
- **ตั้งวงเงินการใช้งาน** ของ key ที่ [console.perplexity.ai](https://console.perplexity.ai) เพื่อจำกัดความเสียหายหากมีคนใช้โดยไม่ได้รับอนุญาต
- `ALLOWED_HOSTS` ป้องกันการโจมตีแบบ DNS rebinding จากเว็บเบราว์เซอร์ ควรใส่เฉพาะชื่อที่ใช้จริง แต่ไม่ได้ป้องกันการเรียกตรงจากเครือข่าย
- **อย่า commit `.env`** ไฟล์นี้อยู่ใน `.gitignore` แล้ว key อยู่ใน container เท่านั้น เอเจนต์ไม่เห็น key
- พอร์ตข้อมูลการใช้งาน (8081) ไม่เปิดออกนอก Docker และไม่มีคำถามหรือคำตอบ ตั้ง `USAGE_TOKEN` ถ้าต้องการให้ต้องใช้ token
- container รันด้วยผู้ใช้ที่ไม่ใช่ root
- ผลค้นหาและคำตอบมาจากอินเทอร์เน็ตทั่วไป ควรบอกเอเจนต์ให้ถือเป็นข้อมูล ไม่ใช่คำสั่ง

## แก้ปัญหา

| สิ่งที่เห็น | สาเหตุและวิธีแก้ |
|---|---|
| `network agent_network declared as external, but could not be found` | สั่ง `docker network create agent_network` หรือตั้ง `DOCKER_NETWORK` เป็น network ที่มีอยู่ |
| `port is already allocated` | โปรแกรมอื่นใช้พอร์ต 8803 อยู่ ตั้ง `PUBLISH_PORT` เป็นพอร์ตที่ว่าง และแก้ `ALLOWED_HOSTS` |
| container หยุดทำงาน และ log แสดง `PERPLEXITY_API_KEY environment variable is required` | ใส่ key ใน `.env` แล้วสั่ง `docker compose up -d` |
| HTTP 421 `Misdirected request` | `host:port` ใน URL ไม่อยู่ใน `ALLOWED_HOSTS` เพิ่มให้ตรงทุกตัวอักษร แล้วสั่ง `docker compose up -d` |
| `Perplexity API error: 401 Unauthorized` | key ผิดหรือถูกยกเลิก สร้าง key ใหม่ที่ console.perplexity.ai |
| client แจ้ง timeout ระหว่างค้นคว้า | เพิ่ม timeout ของ client (600 วินาทีขึ้นไป) และถ้าจำเป็นเพิ่ม `PERPLEXITY_TIMEOUT_MS` |
| `Tool perplexity_ask disabled` หรือ `not found` | เครื่องมือถูกปิดอยู่ ตั้ง `ENABLE_…` เป็น `true` สั่ง `docker compose up -d` แล้วเชื่อมต่อ client ใหม่ |
| client ไม่เห็นเครื่องมือบางตัว | ตรวจ `GET :8081/health` แล้วเชื่อมต่อ client ใหม่ |
| client แบบเบราว์เซอร์ถูกปฏิเสธ | เพิ่มที่อยู่ของหน้านั้นใน `ALLOWED_ORIGINS` |
| `/usage` ไม่มีระเบียน | ตั้ง `PERPLEXITY_PROXY` ไว้ (hook มองไม่เห็นการเรียกเหล่านั้น) หรือ `USAGE_LOG=false` |

ดู log ของ server ได้ด้วย `docker compose logs -f` ตั้ง `PERPLEXITY_LOG_LEVEL=DEBUG` เมื่อต้องการรายละเอียดมากขึ้น

## พัฒนาต่อ

ใช้ server ทางการโดยไม่แก้ไข โค้ดของโปรเจกต์นี้มีเพียงไฟล์ hook 2 ไฟล์ที่โหลดก่อนด้วย `node --import`

| ไฟล์ | เนื้อหา |
|---|---|
| `Dockerfile` | build จาก image `node` ติดตั้ง server ตาม `package-lock.json` โหลด hook ทั้งสอง และรันด้วยผู้ใช้ที่ไม่ใช่ root |
| `tools-hook.mjs` | เปิด/ปิดเครื่องมือตาม `ENABLE_PERPLEXITY_*` (ครอบ `McpServer.registerTool` ของ MCP SDK และปิดเครื่องมือทันทีหลังลงทะเบียน) |
| `usage-hook.mjs` | บันทึก token เวลา และค่าใช้จ่ายของการเรียก Perplexity ทุกครั้ง และให้บริการ `GET /usage` กับ `GET /health` ที่พอร์ต 8081 |
| `tests/` | ทดสอบ `tools-hook.mjs` กับ server จริง และ `usage-hook.mjs` กับ Perplexity จำลอง (ไม่เสียเงิน) |
| `docker-compose.yml` | พอร์ต docker network volume ของบันทึกการใช้งาน และอ่านค่าจาก `.env` |
| `package.json`, `package-lock.json` | ระบุเวอร์ชันของ server และไลบรารีทุกตัว |

รันเทสต์ (ไม่ต้องมี Node.js บนเครื่อง)

```bash
docker run --rm -v "$PWD:/w" -w /w node:22.23.3-alpine3.24 sh -c "npm ci && npm test"
```

### อัปเดต Perplexity MCP server

```bash
docker run --rm -v "$PWD:/w" -w /w node:22.23.3-alpine3.24 sh -c "npm install --package-lock-only --no-audit --no-fund @perplexity-ai/mcp-server@<เวอร์ชันใหม่>"
```

```bash
docker compose up -d --build
```

รันเทสต์ แล้ว commit ไฟล์ `package.json` และ `package-lock.json` ที่เปลี่ยนไป ถ้าใช้ PowerShell ให้เขียน `${PWD}` แทน `$PWD`

## สัญญาอนุญาต

[MIT](LICENSE) © 2026 Chacharin Lertyosbordin
Perplexity MCP server เป็นลิขสิทธิ์ของ Perplexity AI ภายใต้สัญญาอนุญาต MIT ([ซอร์สโค้ด](https://github.com/perplexityai/modelcontextprotocol))
Perplexity เป็นเครื่องหมายการค้าของเจ้าของ โครงการนี้ไม่ได้เกี่ยวข้องกับ Perplexity AI
