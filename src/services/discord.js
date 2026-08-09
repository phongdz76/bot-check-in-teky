import { DISCORD_WEBHOOK } from "../config/index.js";

/** Gửi thông báo Discord qua Webhook (có retry) */
export async function sendDiscord(content, embeds = null) {
  if (!DISCORD_WEBHOOK) {
    console.log("   [DISCORD] Khong co DISCORD_WEBHOOK, bo qua.");
    return;
  }

  const body = {};
  if (content) body.content = content;
  if (embeds) body.embeds = embeds;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok || res.status === 204) {
        return; // Thành công
      }

      const text = await res.text();
      console.log(`   [DISCORD] Lan ${attempt}/${maxRetries} - Loi ${res.status}: ${text.substring(0, 200)}`);

      if (attempt < maxRetries) {
        const delay = attempt * 3000; // 3s, 6s
        console.log(`   [DISCORD] Thu lai sau ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (err) {
      console.log(`   [DISCORD] Lan ${attempt}/${maxRetries} - Loi: ${err.message}`);
      if (attempt < maxRetries) {
        const delay = attempt * 3000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  console.log("   [DISCORD] Da thu 3 lan nhung van that bai!");
}



