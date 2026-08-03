require("dotenv").config();
process.env.TZ = "Asia/Ho_Chi_Minh"; // Cố định múi giờ Việt Nam cho Cloud Server

// ============================================================
// CẤU HÌNH
// ============================================================
const API_BASE = "https://api.tutoro.vn/v1";
const TOKEN = process.env.TUTORO_TOKEN;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const CHECKIN_BEFORE_MINUTES = 15; // Check-in trước giờ học 15 phút

if (!TOKEN) {
  console.error("[LOI] Thieu TUTORO_TOKEN trong file .env!");
  process.exit(1);
}

// ============================================================
// TIỆN ÍCH
// ============================================================

/** Chuyển phút từ 0:00 sang chuỗi "HH:MM" */
function minutesToTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Lấy ngày hôm nay theo format DD-MM-YYYY */
function getTodayStr() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Lấy số phút hiện tại kể từ 0:00 */
function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Sleep ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

/** Gọi API TutorO (có retry) */
async function callApi(method, path, retries = 3) {
  const url = `${API_BASE}${path}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      });

      const text = await res.text();

      // WAF hoặc server trả HTML thay vì JSON
      if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
        throw new Error(`Server trả HTML (WAF chặn hoặc lỗi server)`);
      }

      const json = JSON.parse(text);

      if (!res.ok || json.message?.status_code !== 200) {
        throw new Error(
          `API lỗi [${res.status}]: ${json.message?.text || JSON.stringify(json)}`
        );
      }

      return json;
    } catch (err) {
      console.log(
        `   [CANH BAO] Lan ${attempt}/${retries}: ${err.message}`
      );
      if (attempt < retries) {
        console.log(`   [RETRY] Thu lai sau 5 giay...`);
        await sleep(5000);
      } else {
        throw err;
      }
    }
  }
}

// ============================================================
// LOGIC CHÍNH
// ============================================================

/** Lấy danh sách buổi học hôm nay */
async function getSessionsToday() {
  const today = getTodayStr();
  console.log(`\n[INFO] Dang lay danh sach buoi hoc ngay ${today}...\n`);

  const json = await callApi(
    "GET",
    `/class_sessions?from_date=${today}&to_date=${today}`
  );

  return json.data.list_sessions || [];
}

/** Kiểm tra trạng thái check-in của 1 buổi */
async function getCheckinStatus(sessionId) {
  try {
    const res = await fetch(
      `${API_BASE}/class_sessions/${sessionId}/checkin`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${TOKEN}` },
      }
    );
    const text = await res.text();
    if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) return null;
    const json = JSON.parse(text);
    if (json.message?.status_code === 200 && json.data?.checkin_id) {
      return json.data; // { checkin_id, checkin_datetime, state, note }
    }
    return null;
  } catch {
    return null;
  }
}

/** Check-in 1 buổi học */
async function checkinSession(session) {
  const timeStr = minutesToTimeStr(session.datetime.start_time);
  console.log(`\n[CHECKIN] ${session.class_name}`);
  console.log(`   Bai: ${session.session_chapter}`);
  console.log(`   Gio hoc: ${timeStr}`);
  console.log(`   Session ID: ${session.session_id}`);

  // Kiểm tra đã check-in chưa
  const status = await getCheckinStatus(session.session_id);
  if (status) {
    const checkinDate = new Date(status.checkin_datetime * 1000);
    const checkinTimeStr = `${String(checkinDate.getHours()).padStart(2, "0")}:${String(checkinDate.getMinutes()).padStart(2, "0")}`;
    console.log(`   [DA CHECK-IN] Luc ${checkinTimeStr} - Trang thai: ${status.state}`);

    await sendDiscord(null, [{
      title: "Da check-in",
      color: 0x3498db,
      fields: [
        { name: "Lop", value: session.class_name, inline: true },
        { name: "Gio hoc", value: timeStr, inline: true },
        { name: "Bai", value: session.session_chapter, inline: false },
        { name: "Check-in luc", value: checkinTimeStr, inline: true },
        { name: "Trang thai", value: status.state, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }]);

    return true;
  }

  try {
    const res = await fetch(
      `${API_BASE}/class_sessions/${session.session_id}/checkin`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
      }
    );

    const text = await res.text();
    if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
      throw new Error("Server trả HTML (WAF chặn)");
    }

    const json = JSON.parse(text);

    // ✅ Check-in thành công
    if (json.message?.status_code === 200) {
      console.log(
        `   [OK] Check-in thanh cong! (${json.data.state}) - ID: ${json.data.checkin_id}`
      );

      await sendDiscord(null, [{
        title: "Check-in thanh cong!",
        color: 0x00d26a,
        fields: [
          { name: "Lop", value: session.class_name, inline: true },
          { name: "Gio hoc", value: timeStr, inline: true },
          { name: "Bai", value: session.session_chapter, inline: false },
          { name: "Checkin ID", value: `${json.data.checkin_id}`, inline: true },
          { name: "Trang thai", value: json.data.state, inline: true },
        ],
        timestamp: new Date().toISOString(),
      }]);

      return true;
    }

    // 🔵 Đã check-in trước đó
    if (json.message?.text?.includes("đã check in")) {
      console.log(`   [INFO] Da check-in truoc do roi!`);

      await sendDiscord(null, [{
        title: "Da check-in truoc do",
        color: 0x3498db,
        fields: [
          { name: "Lop", value: session.class_name, inline: true },
          { name: "Gio hoc", value: timeStr, inline: true },
          { name: "Bai", value: session.session_chapter, inline: false },
          { name: "Ghi chu", value: json.message.text, inline: false },
        ],
        timestamp: new Date().toISOString(),
      }]);

      return true; // Vẫn tính là thành công
    }

    // ❌ Lỗi khác
    throw new Error(
      `API lỗi [${json.message?.status_code}]: ${json.message?.text}`
    );
  } catch (err) {
    console.log(`   [LOI] Check-in that bai: ${err.message}`);

    await sendDiscord(null, [{
      title: "Check-in that bai!",
      color: 0xff4757,
      fields: [
        { name: "Lop", value: session.class_name, inline: true },
        { name: "Gio hoc", value: timeStr, inline: true },
        { name: "Loi", value: err.message, inline: false },
      ],
      timestamp: new Date().toISOString(),
    }]);

    return false;
  }
}

/** Chờ đến giờ check-in rồi check-in */
async function waitAndCheckin(session) {
  const startTime = session.datetime.start_time;
  const checkinTime = startTime - CHECKIN_BEFORE_MINUTES;
  const checkinTimeStr = minutesToTimeStr(checkinTime);
  const startTimeStr = minutesToTimeStr(startTime);

  const currentMinutes = getCurrentMinutes();

  // Đã qua giờ học → vẫn thử check-in (API sẽ trả kết quả đúng)
  if (currentMinutes > startTime) {
    console.log(
      `   [INFO] Da qua gio hoc (${startTimeStr}), thu check-in...`
    );
    return await checkinSession(session);
  }

  // Đang trong window check-in → check-in ngay
  if (currentMinutes >= checkinTime && currentMinutes <= startTime) {
    console.log(
      `   [OK] Dang trong thoi gian check-in (${checkinTimeStr} - ${startTimeStr}), check-in ngay!`
    );
    return await checkinSession(session);
  }

  // Chưa đến giờ → chờ
  const waitMinutes = checkinTime - currentMinutes;
  const waitMs = waitMinutes * 60 * 1000;
  const waitHours = Math.floor(waitMinutes / 60);
  const waitMins = waitMinutes % 60;

  const waitStr =
    waitHours > 0 ? `${waitHours} tiếng ${waitMins} phút` : `${waitMins} phút`;

  console.log(
    `   [CHO] Check-in luc ${checkinTimeStr} (con ${waitStr}). Dang cho...`
  );

  await sleep(waitMs);

  // Đến giờ → check-in!
  console.log(`\n[CHECKIN] DA DEN GIO CHECK-IN!`);
  return await checkinSession(session);
}

// ============================================================
// MAIN
// ============================================================

/** Xử lý check-in cho 1 ngày */
async function processToday() {
  const now = new Date();
  const dayStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  console.log("\n═══════════════════════════════════════════");
  console.log(`   TutorO Auto Check-in — ${dayStr}`);
  console.log("═══════════════════════════════════════════");

  const sessions = await getSessionsToday();

  if (sessions.length === 0) {
    console.log("[INFO] Hom nay khong co buoi hoc nao.");
    await sendDiscord(null, [{
      title: `📅 Lich hoc hom nay (${dayStr})`,
      description: "Hôm nay bạn không có lịch dạy nào, nghỉ ngơi thôi! 🎮",
      color: 0x95a5a6,
      timestamp: new Date().toISOString(),
    }]);
    return;
  }

  // Sắp xếp theo giờ bắt đầu
  sessions.sort((a, b) => a.datetime.start_time - b.datetime.start_time);

  console.log(`[INFO] Tim thay ${sessions.length} buoi hoc:\n`);

  const scheduleFields = [];

  sessions.forEach((s, i) => {
    const startStr = minutesToTimeStr(s.datetime.start_time);
    const endStr = minutesToTimeStr(s.datetime.end_time);
    const checkinStr = minutesToTimeStr(
      s.datetime.start_time - CHECKIN_BEFORE_MINUTES
    );
    console.log(`   ${i + 1}. ${s.class_name}`);
    console.log(`      Bai: ${s.session_chapter}`);
    console.log(`      Gio: ${startStr} - ${endStr}`);
    console.log(`      Check-in luc: ${checkinStr}`);
    console.log(`      Hoc sinh: ${s.students_number}`);
    console.log();

    scheduleFields.push({
      name: `${i + 1}. ${s.class_name}`,
      value: `⏰ **Giờ học:** ${startStr} - ${endStr}\n⏳ **Sẽ tự check-in lúc:** ${checkinStr}\n📖 **Bài:** ${s.session_chapter}`,
      inline: false
    });
  });

  // Báo lịch lên Discord
  await sendDiscord(null, [{
    title: `📅 Lich hoc hom nay (${dayStr})`,
    description: `Bot đã quét và tìm thấy **${sessions.length}** buổi học. Bot sẽ tự động check-in đúng giờ cho bạn! 🚀`,
    color: 0xf1c40f, // Màu vàng
    fields: scheduleFields,
    timestamp: new Date().toISOString(),
  }]);


  // Xử lý từng buổi tuần tự (theo thứ tự thời gian)
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const session of sessions) {
    console.log("───────────────────────────────────────────");
    const startStr = minutesToTimeStr(session.datetime.start_time);
    console.log(`[XU LY] ${session.class_name} (${startStr})`);

    const result = await waitAndCheckin(session);
    if (result === true) success++;
    else if (result === false) {
      const currentMinutes = getCurrentMinutes();
      if (currentMinutes > session.datetime.start_time) {
        skipped++;
      } else {
        failed++;
      }
    }
  }

  // Tổng kết
  console.log("\n═══════════════════════════════════════════");
  console.log("   KET QUA");
  console.log("═══════════════════════════════════════════");
  console.log(`   Thanh cong: ${success}`);
  if (skipped > 0) console.log(`   Bo qua (da qua gio): ${skipped}`);
  if (failed > 0) console.log(`   That bai: ${failed}`);
  console.log(`   Tong: ${sessions.length} buoi`);
  console.log("═══════════════════════════════════════════");

  if (failed > 0) {
    console.log(
      "[TIP] Neu check-in that bai do loi 401, hay cap nhat token moi trong file .env"
    );
  }

  // Gửi tổng kết lên Discord
  const summaryDayStr = getTodayStr();
  await sendDiscord(null, [{
    title: `Tong ket check-in — ${summaryDayStr}`,
    color: success > 0 ? 0x00d26a : (failed > 0 ? 0xff4757 : 0xffa502),
    fields: [
      { name: "Thanh cong", value: `${success}`, inline: true },
      { name: "Bo qua", value: `${skipped}`, inline: true },
      { name: "That bai", value: `${failed}`, inline: true },
      { name: "Tong buoi", value: `${sessions.length}`, inline: true },
    ],
    timestamp: new Date().toISOString(),
  }]);
}

/** Tính số ms từ bây giờ đến 6:00 sáng hôm sau */
function msUntilTomorrow6AM() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0); // 6:00 sáng hôm sau
  return tomorrow.getTime() - now.getTime();
}

/** Format ms thành chuỗi dễ đọc */
function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} tiếng ${minutes} phút`;
  return `${minutes} phút`;
}

// ============================================================
// VÒNG LẶP CHÍNH — Chạy mỗi ngày
// ============================================================

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║   TutorO Auto Check-in — CHE DO 24/7      ║");
  console.log("║   Tự động check-in mỗi ngày              ║");
  console.log("║   Nhấn Ctrl+C để dừng                    ║");
  console.log("╚═══════════════════════════════════════════╝");

  await sendDiscord(null, [{
    title: "TutorO Auto Check-in Da Bat",
    description: "Bot dang chay o che do 24/7. Tu dong check-in moi ngay.",
    color: 0x9b59b6, // Purple
    timestamp: new Date().toISOString(),
  }]);

  while (true) {
    try {
      await processToday();
    } catch (err) {
      console.error(`\n[LOI] Loi xu ly hom nay: ${err.message}`);
      console.log("[CANH BAO] Se thu lai vao ngay mai...");
    }

    // Chờ đến 6:00 sáng hôm sau
    const waitMs = msUntilTomorrow6AM();
    console.log(
      `\n[DONE] Xong ngay hom nay! Cho den 06:00 sang mai (${formatDuration(waitMs)})...`
    );
    console.log("─".repeat(45));

    await sleep(waitMs);
  }
}

// ============================================================
// WEB SERVER MINI (Dành cho Render.com / UptimeRobot)
// ============================================================
const http = require("http");
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("TutorO Bot is running 24/7!\n");
});

server.listen(PORT, () => {
  console.log(`\n🌐 Web server mini dang chay tren port ${PORT}`);
  console.log(`💡 Dung UptimeRobot ping vao server nay de giu bot thuc 24/7\n`);
  // Khởi động vòng lặp check-in sau khi bật server
  main();
});
