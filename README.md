# mcp-perplexity

MCP server ที่ช่วยให้ AI agent ที่รองรับ MCP เช่น Hermes ค้นหาข้อมูลบนเว็บ ถามตอบ และค้นคว้าเชิงลึกผ่าน [Perplexity](https://www.perplexity.ai) ได้โดยตรง
ทำงานบน Docker ในโหมด **streamable HTTP** โดย agent ไม่ต้องรู้ API key ของ Perplexity และไม่ต้องติดตั้ง Node.js บนเครื่อง

ผู้พัฒนา: **Chacharin Lertyosbordin**

> โปรเจกต์นี้จัดเตรียม Docker และการตั้งค่าให้ [Perplexity MCP server ฉบับทางการ](https://www.npmjs.com/package/@perplexity-ai/mcp-server) เท่านั้น ไม่ได้พัฒนาตัว MCP server เอง
> Perplexity MCP server พัฒนาโดย Perplexity AI ภายใต้สัญญาอนุญาต MIT และโปรเจกต์นี้ไม่ใช่ผลงานทางการของ Perplexity

## เครื่องมือที่มีให้

| เครื่องมือ | หน้าที่ | API ของ Perplexity ที่ใช้ | ความเร็วและค่าใช้จ่าย |
|---|---|---|---|
| `perplexity_search` | ค้นหาเว็บ แล้วส่งรายการผลการค้นหากลับมาตามต้นฉบับ ได้แก่ ชื่อหน้าเว็บ URL ข้อความโดยย่อ และวันที่ โดยไม่ให้ AI สรุป | Search API | เร็ว ราคาถูกที่สุด |
| `perplexity_ask` | ตอบคำถามทั่วไปโดยค้นข้อมูลจากเว็บ พร้อมแหล่งอ้างอิง | Agent API (preset `fast`) | เร็ว |
| `perplexity_reason` | วิเคราะห์ประเด็นอย่างเป็นขั้นตอน เช่น เปรียบเทียบ คำนวณ หรือให้เหตุผล โดยอ้างอิงข้อมูลจากเว็บ | Agent API (preset `medium`) | ปานกลาง |
| `perplexity_research` | ค้นคว้าเชิงลึกจากหลายแหล่งข้อมูล แล้วเขียนเป็นรายงานพร้อมแหล่งอ้างอิง | Agent API (preset `high`) | ช้า อาจใช้เวลาหลายนาที และราคาสูงที่สุด |

ทุกเครื่องมือเป็นแบบอ่านอย่างเดียว และการเรียกใช้ทุกครั้งจะคิดค่าใช้จ่ายกับ `PERPLEXITY_API_KEY` ของคุณ

## หลักการทำงาน

```
agent ──POST /mcp──▶ mcp-perplexity (container)
                       ① ตรวจ Host header กับรายชื่อใน ALLOWED_HOSTS (หากไม่ตรงจะตอบ HTTP 421)
                       ② ส่งคำขอไปยังเครื่องมือที่เรียก
                       ③ เครื่องมือเรียก https://api.perplexity.ai ด้วย PERPLEXITY_API_KEY
                     ◀── ส่งผลลัพธ์กลับไปยัง agent
```

ระบบนี้ไม่เก็บสถานะการทำงาน ไม่มีฐานข้อมูล และไม่ต้อง mount โฟลเดอร์ใด ๆ

## เริ่มต้นใช้งาน

### สิ่งที่ต้องเตรียม

- **Docker** (Docker Desktop หรือ Docker Engine) โดยไม่ต้องติดตั้ง Node.js
- **การเชื่อมต่ออินเทอร์เน็ตระหว่าง build ครั้งแรก** เพื่อดาวน์โหลด image ของ Node และแพ็กเกจจาก npm
- **Perplexity API key** ขอได้ที่ https://console.perplexity.ai ซึ่ง**จำเป็นต้องมี** หากไม่กำหนด ระบบจะไม่เริ่มทำงาน

### ขั้นตอนการติดตั้ง

```bash
git clone https://github.com/chacharin/mcp-perplexity.git
cd mcp-perplexity
cp .env.example .env                  # จากนั้นใส่ PERPLEXITY_API_KEY ในไฟล์ .env
docker network create agent_network   # สร้างครั้งแรกครั้งเดียว หากต้องการใช้ชื่ออื่นให้กำหนดใน DOCKER_NETWORK
docker compose up -d --build
curl http://127.0.0.1:8803/health
```

หาก `/health` ตอบ `{"status":"ok", …}` แปลว่า server ทำงานแล้ว แต่ยังไม่ได้ตรวจว่า API key ถูกต้อง
key จะถูกตรวจเมื่อเรียกเครื่องมือครั้งแรก หาก key ผิด ผลลัพธ์จะแจ้ง `401 Unauthorized` (ดูหัวข้อ[ข้อผิดพลาด](#ข้อผิดพลาด))

คำอธิบายการตั้งค่าทั้งหมดอยู่ในไฟล์ [`.env.example`](.env.example) โดยในไฟล์ `.env` ให้กำหนดเฉพาะค่าที่จำเป็น และค่าที่ต้องการเปลี่ยนจากค่าเริ่มต้น
เมื่อแก้ไข `.env` แล้ว ให้สั่ง `docker compose up -d` อีกครั้ง โดยไม่ต้อง build ใหม่

### การเชื่อมต่อกับ MCP client

ตัวอย่างการตั้งค่าใน Hermes (`config.yaml`):

```yaml
mcp_servers:
  perplexity:
    url: http://mcp-perplexity:8080/mcp
    timeout: 600        # perplexity_research อาจใช้เวลาหลายนาที ควรนานกว่าเวลาที่การค้นใช้จริง
```

หาก timeout ของ client สั้นกว่าเวลาที่ Perplexity ใช้ประมวลผล client จะแจ้งว่าการเรียกล้มเหลว ทั้งที่ Perplexity ยังทำงานและคิดค่าใช้จ่ายอยู่

ชื่อ host และพอร์ตที่ client ใช้เรียก ต้องอยู่ในรายชื่อ `ALLOWED_HOSTS` ทุกตัวอักษร ค่าตัวอย่างรองรับ `mcp-perplexity:8080` (agent บน docker network) และ `localhost:8803`, `127.0.0.1:8803` (เครื่องนี้) แล้ว
หากต้องการเรียกจากเครื่องอื่นผ่าน `http://<IP ของเครื่อง>:8803/mcp` ให้เพิ่ม `<ชื่อเครื่อง>:8803` หรือ `<IP>:8803` ลงใน `ALLOWED_HOSTS`

## วิธีใช้งาน

เมื่อเชื่อมต่อแล้ว ผู้ใช้เพียงพิมพ์สั่ง agent ด้วยภาษาปกติ agent จะเลือกเครื่องมือและกรอกค่าให้เอง
หัวข้อนี้อธิบายว่าแต่ละงานควรสั่งอย่างไร และเครื่องมือรับค่าอะไรบ้าง

หากต้องการให้ agent ใช้เครื่องมือใดโดยเฉพาะ ให้ระบุในคำสั่ง เช่น "ค้นแบบเร็ว" หรือ "ค้นคว้าเชิงลึก" เพราะแต่ละเครื่องมือมีค่าใช้จ่ายและเวลาต่างกันมาก

### 1. ค้นหาเว็บ (ได้รายการผลการค้นหา)

ตัวอย่างคำสั่ง:

> ค้นเว็บหาลิงก์ GitHub ของ LightRAG
> หาข่าวเกี่ยวกับนโยบาย AI ของไทยในสัปดาห์นี้ ขอเฉพาะจากเว็บ .go.th

agent จะเรียก `perplexity_search`

| ค่า | จำเป็น | ความหมาย |
|---|---|---|
| `query` | ✓ | คำค้นหา |
| `max_results` | | จำนวนผลการค้นหา 1–20 (ค่าเริ่มต้น 10) |
| `max_tokens_per_page` | | จำนวน token สูงสุดที่ดึงจากแต่ละหน้าเว็บ (ค่าเริ่มต้น 1024) |
| `country` | | รหัสประเทศ 2 ตัวอักษรตาม ISO 3166-1 เช่น `TH` เพื่อให้ได้ผลของประเทศนั้น |
| `search_recency_filter` | | ช่วงเวลาของผลการค้นหา: `hour` `day` `week` `month` `year` |
| `search_domain_filter` | | จำกัดโดเมน เช่น `["wikipedia.org"]` หรือตัดโดเมนออกด้วย `-` เช่น `["-reddit.com"]` |
| `search_type` | | `web` (ค่าเริ่มต้น) หรือ `fast` ซึ่งเร็วและถูกกว่า |

ผลลัพธ์เป็นรายการหน้าเว็บ แต่ละรายการมีชื่อหน้า URL ข้อความที่ดึงมาจากหน้านั้น และวันที่ โดยไม่มีการสรุปด้วย AI
เหมาะกับงานที่ต้องการแหล่งข้อมูลต้นฉบับ หรือให้ agent อ่านและสรุปเอง

### 2. ถามคำถาม (ได้คำตอบพร้อมแหล่งอ้างอิง)

ตัวอย่างคำสั่ง:

> LightRAG คืออะไร ตอบสั้น ๆ
> ถาม Perplexity ว่าราคาน้ำมันดิบวันนี้เป็นเท่าไร

agent จะเรียก `perplexity_ask` สำหรับคำถามทั่วไป หรือ `perplexity_reason` สำหรับคำถามที่ต้องวิเคราะห์เป็นขั้นตอน

| ค่า | จำเป็น | ความหมาย |
|---|---|---|
| `messages` | ✓ | รายการข้อความของบทสนทนา แต่ละรายการมี `role` (`system`, `user` หรือ `assistant`) และ `content` |
| `search_recency_filter` | | ช่วงเวลาของข้อมูลที่ใช้ตอบ: `hour` `day` `week` `month` `year` |
| `search_domain_filter` | | จำกัดหรือตัดโดเมน เช่นเดียวกับ `perplexity_search` |
| `search_context_size` | | ปริมาณข้อมูลจากเว็บที่ใช้ตอบ: `low` (เร็วที่สุด) `medium` `high` (ครอบคลุมที่สุด) |

คำตอบเป็นข้อความที่มีเลขอ้างอิง เช่น `[2][3]` ในเนื้อหา และมีรายการ URL ของแหล่งอ้างอิงอยู่ท้ายคำตอบ

### 3. ค้นคว้าเชิงลึก (ได้รายงาน)

ตัวอย่างคำสั่ง:

> ค้นคว้าเชิงลึกเรื่องแนวโน้มการใช้ RAG ในหน่วยงานรัฐ แล้วสรุปเป็นรายงาน

agent จะเรียก `perplexity_research` ซึ่งรับเฉพาะ `messages`
เครื่องมือนี้อาจใช้เวลาหลายนาทีและมีค่าใช้จ่ายสูงที่สุด จึงควรใช้เมื่อต้องการรายงานที่รวบรวมจากหลายแหล่งจริง ๆ และต้องตั้ง timeout ของ client ให้นานพอ

## รูปแบบ JSON ของคำขอและผลลัพธ์

mcp-perplexity มี 2 route

| Route | ใช้ทำอะไร |
|---|---|
| `POST /mcp` | เรียกเครื่องมือทั้งหมดตามมาตรฐาน MCP (JSON-RPC 2.0) agent ใช้ route นี้ |
| `GET /health` | ตรวจว่า server ทำงานอยู่ ไม่ตรวจ API key และไม่เสียค่าใช้จ่าย |

### การส่งคำขอไปที่ `/mcp`

ทุกคำขอต้องมี header สองตัวนี้ และ Host ที่ใช้เรียกต้องอยู่ใน `ALLOWED_HOSTS`

```
Content-Type: application/json
Accept: application/json, text/event-stream
```

server นี้ตอบกลับเป็น JSON ธรรมดา (`Content-Type: application/json`) ตัวอย่างต่อไปนี้จัดบรรทัดใหม่ให้อ่านง่าย

ผลลัพธ์ของทุกเครื่องมือมีข้อความเดียวกัน 2 ที่ คือ `result.content[0].text` และ `result.structuredContent`
โดย `structuredContent` มีคีย์ `results` สำหรับ `perplexity_search` และคีย์ `response` สำหรับเครื่องมืออื่น

### ดูรายการเครื่องมือ (`tools/list`)

คำขอ:

```json
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
```

ผลลัพธ์ (ย่อ):

```json
{"jsonrpc": "2.0", "id": 1, "result": {"tools": [
  {
    "name": "perplexity_ask",
    "description": "Answer a question using web-grounded AI (Perplexity Agent API, fast preset). …",
    "inputSchema": {
      "type": "object",
      "properties": {
        "messages": {"type": "array", "items": {"type": "object", "properties": {
          "role": {"type": "string", "enum": ["system", "user", "assistant"]},
          "content": {"type": "string"}}, "required": ["role", "content"]}},
        "search_recency_filter": {"type": "string", "enum": ["hour", "day", "week", "month", "year"]},
        "search_domain_filter": {"type": "array", "items": {"type": "string"}},
        "search_context_size": {"type": "string", "enum": ["low", "medium", "high"]}
      },
      "required": ["messages"]
    },
    "outputSchema": {"type": "object", "properties": {"response": {"type": "string"}}, "required": ["response"]},
    "annotations": {"readOnlyHint": true, "destructiveHint": false, "idempotentHint": false, "openWorldHint": true}
  },
  {"name": "perplexity_research", "…": "…"},
  {"name": "perplexity_reason", "…": "…"},
  {"name": "perplexity_search", "…": "…"}
]}}
```

### ค้นหาเว็บ (`perplexity_search`)

คำขอ:

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

### ถามคำถาม (`perplexity_ask`, `perplexity_reason`, `perplexity_research`)

ทั้ง 3 เครื่องมือรับคำขอและส่งผลลัพธ์รูปแบบเดียวกัน ต่างกันที่ความลึกของการค้นหา

คำขอ:

```json
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {
  "name": "perplexity_ask",
  "arguments": {
    "messages": [{"role": "user", "content": "LightRAG คืออะไร ตอบสั้น ๆ 2 ประโยค"}],
    "search_context_size": "low"
  }
}}
```

ผลลัพธ์:

```json
{"jsonrpc": "2.0", "id": 3, "result": {
  "content": [{"type": "text",
    "text": "LightRAG คือเฟรมเวิร์ก RAG ที่สร้างกราฟความรู้จากเอกสาร แล้วผสานการค้นหาด้วยกราฟและเวกเตอร์เพื่อดึงข้อมูลที่เชื่อมโยงกัน[2][3] …\n\nCitations:\n[1] https://www.adsfit.co.th/blog/…\n[2] https://arxiv.org/html/2410.05779v1\n[3] https://github.com/hkuds/lightrag\n…"}],
  "structuredContent": {"response": "LightRAG คือเฟรมเวิร์ก RAG … Citations: …"}
}}
```

### ข้อผิดพลาด

| กรณี | ผลลัพธ์ |
|---|---|
| Host ที่ใช้เรียกไม่อยู่ใน `ALLOWED_HOSTS` | HTTP 421 `{"jsonrpc": "2.0", "error": {"code": -32000, "message": "Misdirected request"}, "id": null}` |
| API key ผิดหรือหมดอายุ | `"isError": true` และ `text` เป็น `Perplexity API error: 401 Unauthorized {"error":{"message":"Invalid API key provided. …"}}` |
| ไม่ส่งค่าที่จำเป็น | `"isError": true` และ `text` เป็น `MCP error -32602: Input validation error: Invalid arguments for tool perplexity_ask: Required at messages` |
| เรียกเครื่องมือที่ไม่มี | `"isError": true` และ `text` เป็น `MCP error -32602: Tool <ชื่อ> not found` |
| ไม่ได้กำหนด `PERPLEXITY_API_KEY` | container ไม่เริ่มทำงาน และ `docker logs mcp-perplexity` แสดง `ERROR: PERPLEXITY_API_KEY environment variable is required` |

### ตรวจสถานะ (`GET /health`)

```json
{"status": "ok", "service": "perplexity-mcp-server"}
```

### ทดลองด้วย curl

```bash
curl http://127.0.0.1:8803/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"perplexity_search","arguments":{"query":"LightRAG HKUDS GitHub","max_results":2}}}'
```

คำสั่งนี้เรียก Perplexity จริงและคิดค่าใช้จ่าย หากต้องการทดสอบโดยไม่เสียค่าใช้จ่าย ให้เปลี่ยน `"method":"tools/call"` เป็น `"method":"tools/list"` (และลบ `params` ออก)
บน Windows คำสั่ง curl อาจส่งภาษาไทยที่พิมพ์ในบรรทัดคำสั่งผิดเพี้ยนเป็น `?` ให้บันทึก JSON ของคำขอเป็นไฟล์ UTF-8 เช่น `request.json` แล้วส่งด้วย `-d @request.json` แทน

## การปรับให้เหมาะกับงานของคุณ

ค่าต่อไปนี้เป็นตัวแปรในไฟล์ `.env` ซึ่งไม่จำเป็นต้องกำหนด หากไม่กำหนด ระบบจะใช้ค่าเริ่มต้น
เมื่อต้องการปรับ ให้เพิ่มบรรทัด `ชื่อตัวแปร=ค่า` ลงในไฟล์ `.env` แล้วสั่ง `docker compose up -d` (คำอธิบายและค่าเริ่มต้นของทุกตัวแปรดูได้ใน [`.env.example`](.env.example))

- **`PERPLEXITY_TIMEOUT_MS`** เวลารอคำตอบจาก Perplexity สูงสุด (มิลลิวินาที) ค่าเริ่มต้น 5 นาที ควรเพิ่มหากใช้ `perplexity_research` กับหัวข้อที่กว้างมาก
- **`PERPLEXITY_BASE_URL` และ `PERPLEXITY_PROXY`** ใช้เมื่อต้องเรียก Perplexity ผ่าน proxy ขององค์กร
- **`PERPLEXITY_LOG_LEVEL`** ระดับของ log (`DEBUG` `INFO` `WARN` `ERROR`) ใช้ `DEBUG` เมื่อต้องการหาสาเหตุของปัญหา
- **`ALLOWED_HOSTS` และ `ALLOWED_ORIGINS`** ชื่อ host ที่อนุญาตให้เรียก และโดเมนของ MCP client แบบเว็บที่อนุญาตให้เรียกข้ามโดเมน

## ความปลอดภัย

- **ระบบนี้ไม่มีการยืนยันตัวตน** ผู้ที่เข้าถึงพอร์ตนี้ได้จะใช้โควตา Perplexity ของคุณได้ทันที ค่าเริ่มต้นเปิดให้เครื่องอื่นในเครือข่ายเข้าถึงได้ (`PUBLISH_ADDR=0.0.0.0`)
  หากไม่จำเป็น ให้กำหนด `PUBLISH_ADDR=127.0.0.1` ซึ่ง agent ที่อยู่ใน docker network เดียวกันจะยังเรียกใช้ได้ตามปกติ
- `ALLOWED_HOSTS` ช่วยป้องกันการโจมตีแบบ DNS rebinding ผ่านเว็บเบราว์เซอร์ จึงควรใส่เฉพาะชื่อที่ใช้งานจริง แต่ไม่ได้ป้องกันผู้ที่เรียกตรงจากเครือข่าย
- ควรตั้งวงเงินการใช้งานของ API key ไว้ที่ https://console.perplexity.ai เพื่อจำกัดความเสียหายหากมีผู้ใช้โควตาโดยไม่ได้รับอนุญาต
- API key ถูกเก็บไว้ในไฟล์ `.env` เท่านั้น ไม่ถูกส่งให้ agent และไฟล์นี้จะไม่ถูกส่งขึ้น git

## สำหรับนักพัฒนา

โปรเจกต์นี้ไม่มีโค้ดของตัวเอง มีเพียงไฟล์สำหรับติดตั้งและตั้งค่า

| ไฟล์ | หน้าที่ |
|---|---|
| `Dockerfile` | สร้าง image จาก `node` แล้วติดตั้ง Perplexity MCP server ตาม `package-lock.json` |
| `docker-compose.yml` | กำหนดพอร์ต docker network และอ่านการตั้งค่าจาก `.env` |
| `package.json`, `package-lock.json` | ล็อกเวอร์ชันของ Perplexity MCP server และไลบรารีย่อยทุกตัว ทุกเครื่องที่ build จึงได้ไลบรารีชุดเดียวกัน |

### การอัปเดตเวอร์ชันของ Perplexity MCP server

```bash
docker run --rm -v "$PWD:/w" -w /w node:22.23.3-alpine3.24 \
  sh -c "npm install --package-lock-only --no-audit --no-fund @perplexity-ai/mcp-server@<เวอร์ชันใหม่>"
docker compose up -d --build
```

จากนั้น commit ไฟล์ `package.json` และ `package-lock.json` ที่เปลี่ยนไป
หากใช้ PowerShell ให้เปลี่ยน `$PWD` เป็น `${PWD}` และใช้ `` ` `` แทน `\` สำหรับขึ้นบรรทัดใหม่

## สัญญาอนุญาต

[MIT](LICENSE) © 2026 Chacharin Lertyosbordin
Perplexity MCP server เป็นลิขสิทธิ์ของ Perplexity AI ภายใต้สัญญาอนุญาต MIT ([ซอร์สโค้ด](https://github.com/perplexityai/modelcontextprotocol))
