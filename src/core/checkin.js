import { CHECKIN_BEFORE_MINUTES, API_BASE, TOKEN } from "../config/index.js";
import { minutesToTimeStr, getTodayStr, getCurrentMinutes, sleep, formatDuration } from "../utils/time.js";
import { sendDiscord } from "../services/discord.js";
import { getSessionsToday, getCheckinStatus, getEvaluationStudents, submitEvaluation } from "../services/tutoro.js";
import { getEvalMode } from "../server.js";
import { EVAL_PAYLOAD_NORMAL, EVAL_PAYLOAD_HIGH } from "./evalData.js";

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

/** Tự động đánh giá học sinh của buổi học */
async function evaluateSession(session) {
  console.log(`   [DANH GIA] Bat dau tien trinh danh gia...`);
  const mode = getEvalMode(session.session_id);
  const payloadStr = mode === 2 ? JSON.stringify(EVAL_PAYLOAD_HIGH) : JSON.stringify(EVAL_PAYLOAD_NORMAL);
  
  const students = await getEvaluationStudents(session.session_id);
  if (students.length === 0) {
    console.log(`   [DANH GIA] Khong co danh sach hoc sinh de danh gia.`);
    return;
  }

  let evalSuccess = 0;
  let alreadyEval = 0;
  let evalFail = 0;

  for (const student of students) {
    if (student.evaluation_info?.evaluation_status === true) {
      alreadyEval++;
      continue;
    }

    const payload = JSON.parse(payloadStr);
    const success = await submitEvaluation(session.session_id, student.student_id, payload);
    if (success) {
      evalSuccess++;
    } else {
      evalFail++;
    }
    await sleep(2000); // Nghỉ 2s giữa các lần gửi để tránh spam API
  }

  const modeName = mode === 2 ? "Tích Cực" : "Bình Thường";
  console.log(`   [DANH GIA] Xong! Thanh cong: ${evalSuccess}, Da DG truoc: ${alreadyEval}, Loi: ${evalFail} (Che do: ${modeName})`);

  if (evalSuccess > 0 || evalFail > 0 || alreadyEval > 0) {
    await sendDiscord(null, [{
      title: "Đánh Giá Tự Động",
      color: 0x9b59b6,
      fields: [
        { name: "Lop", value: session.class_name, inline: true },
        { name: "Che do", value: modeName, inline: true },
        { name: "Thanh cong", value: `${evalSuccess}`, inline: true },
        { name: "Da DG truoc", value: `${alreadyEval}`, inline: true },
        { name: "That bai", value: `${evalFail}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }]);
  }
  
  return { success: evalSuccess, already: alreadyEval, fail: evalFail };
}

/** Chờ đến giờ check-in rồi check-in */
async function waitAndCheckin(session) {
  const startTime = session.datetime.start_time;
  const checkinTime = startTime - CHECKIN_BEFORE_MINUTES;
  const checkinTimeStr = minutesToTimeStr(checkinTime);
  const startTimeStr = minutesToTimeStr(startTime);

  const currentMinutes = getCurrentMinutes();

  // Lên lịch đánh giá vào cuối buổi học (dãn thêm 5 phút)
  const scheduleEval = async () => {
    const current = getCurrentMinutes();
    const end = session.datetime.end_time + 5; // Trễ thêm 5 phút
    if (current < end) {
      const wait = end - current;
      console.log(`   [INFO] Da len lich Đánh Giá tu dong vao luc ${minutesToTimeStr(end)} (sau ${wait} phut) cho lop ${session.class_name}`);
      await sleep(wait * 60000);
    }
    return await evaluateSession(session);
  };

  // Đã qua giờ bắt đầu → vẫn thử check-in
  if (currentMinutes > startTime) {
    console.log(`   [INFO] Da qua gio hoc (${startTimeStr}), thu check-in...`);
    const checkedIn = await checkinSession(session);
    return { checkedIn, evalPromise: checkedIn ? scheduleEval() : null };
  }

  // Đang trong window check-in → check-in ngay
  if (currentMinutes >= checkinTime && currentMinutes <= startTime) {
    console.log(`   [INFO] Dang trong thoi gian check-in (${checkinTimeStr} - ${startTimeStr})`);
    const checkedIn = await checkinSession(session);
    return { checkedIn, evalPromise: checkedIn ? scheduleEval() : null };
  }

  // Chưa đến giờ → chờ
  const waitMinutes = checkinTime - currentMinutes;
  console.log(`   [CHO] Cho ${waitMinutes} phut den ${checkinTimeStr} de check-in...`);

  await sleep(waitMinutes * 60000); // Đợi đến đúng phút
  console.log(`\n[CHECKIN] DA DEN GIO CHECK-IN!`);
  const checkedIn = await checkinSession(session);
  return { checkedIn, evalPromise: checkedIn ? scheduleEval() : null };
}

/** Xử lý check-in cho 1 ngày */
export async function processToday() {
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
  const evalPromises = [];

  for (const session of sessions) {
    console.log("───────────────────────────────────────────");
    const startStr = minutesToTimeStr(session.datetime.start_time);
    console.log(`[XU LY] ${session.class_name} (${startStr})`);

    const { checkedIn, evalPromise } = await waitAndCheckin(session);
    if (checkedIn === true) {
      success++;
      if (evalPromise) evalPromises.push(evalPromise);
    } else if (checkedIn === false) {
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

  // Gửi tổng kết check-in lên Discord
  const summaryDayStr = getTodayStr();
  await sendDiscord(null, [{
    title: `Tổng Kết Check-in — ${summaryDayStr}`,
    color: success > 0 ? 0x00d26a : (failed > 0 ? 0xff4757 : 0xffa502),
    fields: [
      { name: "Thành công", value: `${success}`, inline: true },
      { name: "Bỏ qua", value: `${skipped}`, inline: true },
      { name: "Thất bại", value: `${failed}`, inline: true },
      { name: "Tổng buổi", value: `${sessions.length}`, inline: true },
    ],
    timestamp: new Date().toISOString(),
  }]);

  // Chờ tất cả tiến trình đánh giá hoàn tất để tổng kết
  if (evalPromises.length > 0) {
    console.log("\n[INFO] Dang cho cac lop hoc ket thuc de hoan tat Danh Gia...");
    const evalResults = await Promise.all(evalPromises);
    
    let totalEvalSuccess = 0;
    let totalAlreadyEval = 0;
    let totalEvalFail = 0;

    for (const res of evalResults) {
      if (res) {
        totalEvalSuccess += res.success;
        totalAlreadyEval += res.already;
        totalEvalFail += res.fail;
      }
    }

    console.log("\n═══════════════════════════════════════════");
    console.log("   TONG KET DANH GIA TRONG NGAY");
    console.log("═══════════════════════════════════════════");
    console.log(`   Đã đánh giá thành công: ${totalEvalSuccess}`);
    console.log(`   Đã được đánh giá trước: ${totalAlreadyEval}`);
    console.log(`   Lỗi/Thất bại: ${totalEvalFail}`);
    console.log("═══════════════════════════════════════════");

    await sendDiscord(null, [{
      title: `Tổng Kết Đánh Giá — ${summaryDayStr}`,
      color: 0x9b59b6,
      fields: [
        { name: "Thành công", value: `${totalEvalSuccess}`, inline: true },
        { name: "Đã đánh giá trước", value: `${totalAlreadyEval}`, inline: true },
        { name: "Thất bại", value: `${totalEvalFail}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }]);
  }
}


