import { DISCORD_WEBHOOK } from "../config/index.js";

/** Gửi thông báo Discord qua Webhook */
export async function sendDiscord(content, embeds = null) {
  if (!DISCORD_WEBHOOK) {
    console.log("   [DISCORD] Khong co DISCORD_WEBHOOK, bo qua.");
    return;
  }

  const body = {};
  if (content) body.content = content;
  if (embeds) body.embeds = embeds;

  try {
    const res = await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.log(`   [DISCORD] Loi ${res.status}: ${text}`);
    }
  } catch (err) {
    console.log(`   [CANH BAO] Khong gui duoc Discord: ${err.message}`);
  }
}


