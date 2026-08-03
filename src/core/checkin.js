const { CHECKIN_BEFORE_MINUTES, API_BASE, TOKEN } = require("../config");
const { minutesToTimeStr, getTodayStr, getCurrentMinutes, sleep, formatDuration } = require("../utils/time");
const { sendDiscord } = require("../services/discord");
const { getSessionsToday, getCheckinStatus } = require("../services/tutoro");

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
    return true; // Bỏ qua không check-in lại
  }

  // Gọi trực tiếp fetch để dễ đọc statusCode 400
  try {
    const res = await fetch(`${API_BASE}/class_sessions/${session.session_id}/checkin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const text = await res.text();
    const json = JSON.parse(text);

    // Thành công (200)
    if (res.ok && json.message?.status_code === 200) {
      console.log(`   [THANH CONG] Trang thai: ${json.data.state}`);

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

    // Đã check-in trước đó
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

    // Lỗi khác
    throw new Error(`API lỗi [${json.message?.status_code}]: ${json.message?.text}`);
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
    console.log(`   [INFO] Da qua gio hoc (${startTimeStr}), thu check-in...`);
    return await checkinSession(session);
  }

  // Đang trong window check-in → check-in ngay
  if (currentMinutes >= checkinTime && currentMinutes <= startTime) {
    console.log(`   [INFO] Dang trong thoi gian check-in (${checkinTimeStr} - ${startTimeStr})`);
    return await checkinSession(session);
  }

  // Chưa đến giờ → chờ
  const waitMinutes = checkinTime - currentMinutes;
  console.log(`   [CHO] Cho ${waitMinutes} phut den ${checkinTimeStr} de check-in...`);

  await sleep(waitMinutes * 60000); // Đợi đến đúng phút
  console.log(`\n[CHECKIN] DA DEN GIO CHECK-IN!`);
  return await checkinSession(session);
}

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
      title: `Lich hoc hom nay (${dayStr})`,
      description: "Hom nay ban khong co lich day nao, nghi ngoi thoi!",
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
      value: `Gio hoc: ${startStr} - ${endStr}\nSe tu check-in luc: ${checkinStr}\nBai: ${s.session_chapter}`,
      inline: false
    });
  });

  // Báo lịch lên Discord
  await sendDiscord(null, [{
    title: `Lich hoc hom nay (${dayStr})`,
    description: `Bot da quet va tim thay ${sessions.length} buoi hoc. Bot se tu dong check-in dung gio cho ban!`,
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

module.exports = {
  processToday,
};
