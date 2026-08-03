import dotenv from "dotenv";
dotenv.config();
process.env.TZ = "Asia/Ho_Chi_Minh"; // Cố định múi giờ Việt Nam cho Cloud Server

const API_BASE = "https://api.tutoro.vn/v1";
const TOKEN = process.env.TUTORO_TOKEN;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const CHECKIN_BEFORE_MINUTES = 15; // Check-in trước giờ học 15 phút

if (!TOKEN) {
  console.error("[LOI] Thieu TUTORO_TOKEN trong file .env!");
  process.exit(1);
}

export {
  API_BASE,
  TOKEN,
  DISCORD_WEBHOOK,
  CHECKIN_BEFORE_MINUTES,
};
