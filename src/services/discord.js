const { DISCORD_WEBHOOK } = require("../config");

/** Gửi thông báo Discord qua Webhook */
async function sendDiscord(content, embeds = null) {
  if (!DISCORD_WEBHOOK) return;

  const body = {};
  if (content) body.content = content;
  if (embeds) body.embeds = embeds;

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.log(`   [CANH BAO] Khong gui duoc Discord: ${err.message}`);
  }
}

module.exports = { sendDiscord };
