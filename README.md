# mcp-perplexity-docker

ชุดติดตั้ง **Perplexity MCP server ฉบับทางการ** ([`@perplexity-ai/mcp-server`](https://www.npmjs.com/package/@perplexity-ai/mcp-server)) บน Docker ในโหมด **streamable HTTP**
ช่วยให้ AI agent ที่รองรับ MCP เช่น Hermes ค้นหาข้อมูลบนเว็บผ่าน Perplexity ได้ทันที โดยไม่ต้องติดตั้ง Node.js บนเครื่อง

ผู้พัฒนา: **Chacharin Lertyosbordin**

> โปรเจกต์นี้จัดเตรียม Docker และการตั้งค่าให้พร้อมใช้งานเท่านั้น ส่วนตัว MCP server พัฒนาโดย Perplexity AI
> ภายใต้สัญญาอนุญาต MIT และโปรเจกต์นี้ไม่ใช่ผลงานทางการของ Perplexity หรือได้รับการรับรองจาก Perplexity

## เครื่องมือที่มีให้

| เครื่องมือ | API ที่ใช้ | เหมาะกับงาน | ความเร็วและค่าใช้จ่าย |
|---|---|---|---|
| `perplexity_search` | Search API | ต้องการผลการค้นหาตามต้นฉบับ ได้แก่ ชื่อหน้าเว็บ URL ข้อความโดยย่อ และวันที่ โดยกำหนดจำนวนผล ประเทศ และช่วงเวลาได้ | เร็ว ราคาถูกที่สุด |
| `perplexity_ask` | Agent API (preset `fast`) | ถามคำถามทั่วไปและต้องการคำตอบพร้อมแหล่งอ้างอิง | เร็ว |
| `perplexity_reason` | Agent API (preset `medium`) | วิเคราะห์ประเด็นอย่างเป็นขั้นตอนโดยอ้างอิงข้อมูลจากเว็บ | ปานกลาง |
| `perplexity_research` | Agent API (preset `high`) | ค้นคว้าเชิงลึกจากหลายแหล่งข้อมูล | ช้า อาจใช้เวลาหลายนาที และราคาสูงที่สุด |

การเรียกใช้เครื่องมือทุกครั้งจะคิดค่าใช้จ่ายกับ `PERPLEXITY_API_KEY` ของคุณ

## หลักการทำงาน

```
agent ──POST /mcp──▶ mcp-perplexity (container)
                       ① ตรวจสอบ Host header กับรายชื่อใน ALLOWED_HOSTS (หากไม่ตรงจะตอบกลับ HTTP 421)
                       ② MCP SDK ส่งคำขอไปยังเครื่องมือที่เรียก
                       ③ เครื่องมือเรียก https://api.perplexity.ai ด้วย PERPLEXITY_API_KEY
                     ◀── ส่งผลลัพธ์กลับไปยัง agent
```

ระบบนี้ไม่เก็บสถานะการทำงาน ไม่มีฐานข้อมูล และไม่ต้อง mount โฟลเดอร์ใด ๆ

## เริ่มต้นใช้งาน

### สิ่งที่ต้องเตรียม

- **Docker** (Docker Desktop หรือ Docker Engine) โดยไม่ต้องติดตั้ง Node.js
- **การเชื่อมต่ออินเทอร์เน็ตระหว่าง build ครั้งแรก** เพื่อดาวน์โหลด image ของ Node และแพ็กเกจจาก npm
- **Perplexity API key** ขอได้ที่ https://console.perplexity.ai

### ขั้นตอนการติดตั้ง

```bash
git clone https://github.com/chacharin/mcp-perplexity.git
cd mcp-perplexity
cp .env.example .env                  # จากนั้นใส่ PERPLEXITY_API_KEY ในไฟล์ .env
docker network create agent_network   # สร้างครั้งแรกครั้งเดียว หากต้องการใช้ชื่ออื่นให้กำหนดใน DOCKER_NETWORK
docker compose up -d --build
curl http://127.0.0.1:8803/health
```

คำอธิบายการตั้งค่าทั้งหมดอยู่ในไฟล์ [`.env.example`](.env.example) โดยในไฟล์ `.env` ให้กำหนดเฉพาะค่าที่จำเป็น และค่าที่ต้องการเปลี่ยนจากค่าเริ่มต้น
เมื่อแก้ไข `.env` แล้ว ให้สั่ง `docker compose up -d` อีกครั้ง โดยไม่ต้อง build ใหม่

## การเชื่อมต่อกับ MCP client

ตัวอย่างการตั้งค่าใน Hermes (`config.yaml`):

```yaml
mcp_servers:
  perplexity:
    url: http://mcp-perplexity:8080/mcp
    timeout: 600        # perplexity_research อาจใช้เวลาหลายนาที ควรตั้งให้นานกว่าเวลาที่การค้นใช้จริง
```

หาก timeout ของ client สั้นกว่าเวลาที่ Perplexity ใช้ประมวลผล client จะแจ้งว่าการเรียกล้มเหลว ทั้งที่ Perplexity ยังทำงานและคิดค่าใช้จ่ายอยู่
หากต้องการเรียกใช้จากเครื่องอื่นผ่านพอร์ต 8803 ให้เพิ่ม `<ชื่อเครื่อง>:8803` หรือ `<IP>:8803` ลงใน `ALLOWED_HOSTS`

## ความปลอดภัย

- **ระบบนี้ไม่มีการยืนยันตัวตน** ผู้ที่เข้าถึงพอร์ตนี้ได้จะใช้โควตา Perplexity ของคุณได้ทันที ค่าเริ่มต้นเปิดให้เครื่องอื่นในเครือข่ายเข้าถึงได้ (`PUBLISH_ADDR=0.0.0.0`)
  หากไม่จำเป็น ให้กำหนด `PUBLISH_ADDR=127.0.0.1` ซึ่ง agent ที่อยู่ใน docker network เดียวกันจะยังเรียกใช้ได้ตามปกติ
- `ALLOWED_HOSTS` ช่วยป้องกันการโจมตีแบบ DNS rebinding ผ่านเว็บเบราว์เซอร์ จึงควรใส่เฉพาะชื่อที่ใช้งานจริง
- API key ถูกเก็บไว้ในไฟล์ `.env` เท่านั้น และไฟล์นี้จะไม่ถูกส่งขึ้น git

## การอัปเดตเวอร์ชันของ Perplexity MCP server

เวอร์ชันที่ใช้ถูกล็อกไว้ใน `package.json` และ `package-lock.json` ซึ่งล็อกไลบรารีย่อยไว้ครบทุกตัว ทุกเครื่องที่ build จึงได้ไลบรารีชุดเดียวกัน หากต้องการอัปเดต ให้สั่ง:

```bash
docker run --rm -v "$PWD:/w" -w /w node:22.23.3-alpine3.24 \
  sh -c "npm install --package-lock-only --no-audit --no-fund @perplexity-ai/mcp-server@<เวอร์ชันใหม่>"
docker compose up -d --build
```

หากใช้ PowerShell ให้เปลี่ยน `$PWD` เป็น `${PWD}` และใช้ `` ` `` แทน `\` สำหรับขึ้นบรรทัดใหม่ จากนั้น commit ไฟล์ `package.json` และ `package-lock.json` ที่เปลี่ยนไป

## สัญญาอนุญาต

[MIT](LICENSE) © 2026 Chacharin Lertyosbordin
Perplexity MCP server เป็นลิขสิทธิ์ของ Perplexity AI ภายใต้สัญญาอนุญาต MIT ([ซอร์สโค้ด](https://github.com/perplexityai/modelcontextprotocol))
