# mcp-perplexity-docker

รัน **Perplexity MCP server ฉบับทางการ** ([`@perplexity-ai/mcp-server`](https://www.npmjs.com/package/@perplexity-ai/mcp-server)) ใน Docker แบบ **streamable HTTP**
เพื่อให้ AI agent ที่รองรับ MCP (เช่น Hermes) ค้นเว็บและค้นคว้าผ่าน Perplexity ได้ โดยไม่ต้องติดตั้ง Node.js บนเครื่อง

ผู้พัฒนา: **Chacharin Lertyosbordin**

> โปรเจกต์นี้คือการบรรจุ (packaging) และตั้งค่าให้พร้อมใช้ ตัว MCP server พัฒนาโดย Perplexity AI
> ภายใต้สัญญาอนุญาต MIT โปรเจกต์นี้ไม่ได้เป็นผลงานทางการหรือได้รับการรับรองจาก Perplexity

## เครื่องมือ

| เครื่องมือ | เรียก | ใช้เมื่อ | ความเร็ว / ค่าใช้จ่าย |
|---|---|---|---|
| `perplexity_search` | Search API | ต้องการรายการผลค้นหาดิบ (ชื่อหน้า, URL, ข้อความย่อ, วันที่) เลือกจำนวนผล ประเทศ และช่วงเวลาได้ | เร็ว · ถูกที่สุด |
| `perplexity_ask` | Agent API (preset `fast`) | ถามตอบทั่วไปพร้อมอ้างอิง | เร็ว |
| `perplexity_reason` | Agent API (preset `medium`) | วิเคราะห์เป็นขั้นตอนพร้อมค้นเว็บ | ปานกลาง |
| `perplexity_research` | Agent API (preset `high`) | ค้นเชิงลึกจากหลายแหล่ง | ช้า (อาจหลายนาที) · แพงที่สุด |

ทุกการเรียกคิดค่าใช้จ่ายกับ `PERPLEXITY_API_KEY` ของคุณ

## หลักการทำงาน

```
agent ──POST /mcp──▶ mcp-perplexity (container)
                       ① ตรวจ Host header กับ ALLOWED_HOSTS (ไม่ตรง → HTTP 421)
                       ② MCP SDK เลือกเครื่องมือ
                       ③ เรียก https://api.perplexity.ai ด้วย PERPLEXITY_API_KEY
                     ◀── คืนผลให้ agent
```

ไม่เก็บสถานะ ไม่มีฐานข้อมูล ไม่ mount โฟลเดอร์ใด ๆ

## เริ่มใช้งาน

### สิ่งที่ต้องมี

- **Docker** (Docker Desktop หรือ Docker Engine) — ไม่ต้องติดตั้ง Node.js
- **อินเทอร์เน็ตตอน build ครั้งแรก** — ดึง image ของ Node และแพ็กเกจจาก npm
- **Perplexity API key** จาก https://console.perplexity.ai

### ติดตั้ง

```bash
git clone <URL ของ repo นี้>
cd <โฟลเดอร์ของ repo>
cp .env.example .env                  # แล้วใส่ PERPLEXITY_API_KEY
docker network create agent_network   # ครั้งแรกครั้งเดียว — ชื่ออื่นตั้งได้ด้วย DOCKER_NETWORK
docker compose up -d --build
curl http://127.0.0.1:8803/health
```

ค่าตั้งทั้งหมดและคำอธิบายอยู่ใน [`.env.example`](.env.example) — `.env` ใส่เฉพาะค่าที่ต้องตั้งและค่าที่ต้องการให้ต่างจากค่าเริ่มต้น
แก้ `.env` แล้วสั่ง `docker compose up -d` (ไม่ต้อง build ใหม่)

## เชื่อมกับ MCP client

ตัวอย่างสำหรับ Hermes (`config.yaml`):

```yaml
mcp_servers:
  perplexity:
    url: http://mcp-perplexity:8080/mcp
    timeout: 600        # perplexity_research ใช้เวลาหลายนาที อย่าตั้งต่ำกว่าเวลาที่มันใช้จริง
```

ถ้า timeout ของ client สั้นกว่าเวลาที่ Perplexity ใช้ client จะรายงานว่าล้มเหลว ทั้งที่ Perplexity ยังทำงานและคิดค่าใช้จ่ายอยู่
ถ้าเรียกจากเครื่องอื่นผ่านพอร์ต 8803 ต้องเพิ่ม `<ชื่อเครื่อง>:8803` หรือ `<IP>:8803` ใน `ALLOWED_HOSTS`

## ความปลอดภัย

- **ไม่มีระบบยืนยันตัวตน** — ใครที่เรียกพอร์ตนี้ได้ก็ใช้โควตา Perplexity ของคุณได้ ค่าเริ่มต้นเปิดให้เครื่องอื่นในเครือข่ายเรียกได้ (`PUBLISH_ADDR=0.0.0.0`)
  ถ้าไม่จำเป็น ให้ตั้ง `PUBLISH_ADDR=127.0.0.1` — agent ใน docker network เดียวกันยังเรียกได้ตามปกติ
- `ALLOWED_HOSTS` กันการโจมตีแบบ DNS rebinding จากเว็บเบราว์เซอร์ ใส่เฉพาะชื่อที่ใช้จริง
- API key อยู่ใน `.env` เท่านั้น (ไม่ขึ้น git)

## ปรับรุ่นของ Perplexity MCP server

รุ่นที่ใช้ถูกล็อกไว้ใน `package.json` และ `package-lock.json` (ล็อกไลบรารีย่อยทุกตัว) ทุกคน build แล้วได้ของชุดเดียวกัน ถ้าจะอัปเดต:

```bash
docker run --rm -v "$PWD:/w" -w /w node:22.23.3-alpine3.24 \
  sh -c "npm install --package-lock-only --no-audit --no-fund @perplexity-ai/mcp-server@<รุ่นใหม่>"
docker compose up -d --build
```

บน PowerShell ใช้ `${PWD}` แทน `$PWD` และขึ้นบรรทัดใหม่ด้วย `` ` `` แทน `\` แล้ว commit `package.json` กับ `package-lock.json` ไปด้วย

## สัญญาอนุญาต

[MIT](LICENSE) © 2026 Chacharin Lertyosbordin
ตัว Perplexity MCP server เป็นลิขสิทธิ์ของ Perplexity AI ภายใต้ MIT ([source](https://github.com/perplexityai/modelcontextprotocol))
