import dotenv from "dotenv";
dotenv.config();
process.env.TZ = "Asia/Ho_Chi_Minh"; // Cố định múi giờ Việt Nam cho Cloud Server

const API_BASE = "https://api.tutoro.vn/v1";
let TOKEN = process.env.TUTORO_TOKEN || "";
const TUTORO_PHONE = process.env.TUTORO_PHONE || "";
const TUTORO_PASSWORD = process.env.TUTORO_PASSWORD || "";
const DEVICE_ID = process.env.DEVICE_ID || "784c3a7b4fcf82b4";
const FIREBASE_TOKEN = process.env.FIREBASE_TOKEN || "dyn0EuOATmqdSvoceLhT5dK1cQi8xap0BGIigbFEtgf_IXGZbTWCgRFNfo2y8kMkjzDMZMwJjnkTfMvEvVzgvoL_WjB7hjSuXQwUSyrfN7I";
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "";
const CHECKIN_BEFORE_MINUTES = parseInt(process.env.CHECKIN_BEFORE_MINUTES) || 15;

export function setToken(newToken) {
  TOKEN = newToken;
}



export {
  API_BASE,
  TOKEN,
  TUTORO_PHONE,
  TUTORO_PASSWORD,
  DEVICE_ID,
  FIREBASE_TOKEN,
  DISCORD_WEBHOOK,
  CHECKIN_BEFORE_MINUTES,
};
