import { DISCORD_WEBHOOK } from "../config/index.js";

/** Gửi thông báo Discord qua Webhook (có retry + bypass Cloudflare) */
export async function sendDiscord(content, embeds = null) {
  if (!DISCORD_WEBHOOK) {
    console.log("   [DISCORD] Khong co DISCORD_WEBHOOK, bo qua.");
    return;
  }

  const body = {};
  if (content) body.content = content;
  if (embeds) body.embeds = embeds;

  // Thử nhiều URL khác nhau để bypass Cloudflare
  const urls = [
    DISCORD_WEBHOOK,
    DISCORD_WEBHOOK.replace("discord.com", "canary.discord.com"),
    DISCORD_WEBHOOK.replace("discord.com", "ptb.discord.com"),
  ];

  for (const url of urls) {
    const ok = await trySend(url, body);
    if (ok) return;
    // Chờ 2s trước khi thử URL tiếp
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("   [DISCORD] Tat ca URL deu that bai!");
}

async function trySend(url, body) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "TutorO-Bot/1.0",
          "Accept": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok || res.status === 204) {
        return true; // Thành công
      }

      // Rate limit — chờ rồi thử lại
      if (res.status === 429) {
        let retryAfter = 5;
        try {
          const data = await res.json();
          if (data.retry_after) retryAfter = Math.ceil(data.retry_after) + 1;
        } catch {
          // Response là HTML (Cloudflare) — chờ lâu hơn
          retryAfter = 10;
        }
        console.log(`   [DISCORD] 429 rate limit, cho ${retryAfter}s (${attempt}/${maxRetries})`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      console.log(`   [DISCORD] Loi ${res.status} (${attempt}/${maxRetries})`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 3000));
      }
    } catch (err) {
      console.log(`   [DISCORD] Loi mang: ${err.message} (${attempt}/${maxRetries})`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 3000));
      }
    }
  }
  return false;
}
