import http from "http";
import { getSessionsToday, getSessionsWeek, getCheckinStatus, getEvaluationStudents, submitEvaluation, getAbsentStudentIds, callApi } from "./services/tutoro.js";
import { formatDuration, sleep } from "./utils/time.js";
import { EVAL_PAYLOAD_NORMAL, EVAL_PAYLOAD_HIGH } from "./core/evalData.js";
import { API_BASE, TOKEN } from "./config/index.js";

// Lưu trữ chế độ đánh giá cho từng buổi học (1: Bình thường, 2: Tích cực)
// Mặc định là 1 nếu không có.
const evalModes = new Map();

// Lưu trạng thái check-in thất bại để retry
const failedCheckins = new Map(); // sessionId -> { failedAt, retryCount }

export function getEvalMode(sessionId) {
  const key = String(sessionId);
  return evalModes.has(key) ? evalModes.get(key) : 1;
}

// ─── HTML Templates ───────────────────────────────────────────

function renderWeeklyCalendarPage(weekData, todaySessions) {
  const { sessions, monday, sunday } = weekData;

  const [md, mm, my] = monday.split("-");
  const mondayDate = new Date(parseInt(my), parseInt(mm) - 1, parseInt(md));

  const days = [];
  const dayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    days.push({
      name: dayNames[i],
      date: d,
      dateStr: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      sessions: []
    });
  }

  const today = new Date();
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;

  for (const s of sessions) {
    let sessionDayIdx = -1;
    if (s.datetime?.weekday != null) {
      sessionDayIdx = s.datetime.weekday;
    } else if (s.datetime?.day && s.datetime?.month && s.datetime?.year) {
      const sDate = new Date(s.datetime.year, s.datetime.month - 1, s.datetime.day);
      const sDow = sDate.getDay();
      sessionDayIdx = sDow === 0 ? 6 : sDow - 1;
    }
    if (sessionDayIdx >= 0 && sessionDayIdx < 7) {
      days[sessionDayIdx].sessions.push(s);
    }
  }

  for (const day of days) {
    day.sessions.sort((a, b) => a.datetime.start_time - b.datetime.start_time);
  }

  let minHour = 24, maxHour = 0;
  for (const day of days) {
    for (const s of day.sessions) {
      const startH = Math.floor(s.datetime.start_time / 60);
      const endH = Math.ceil(s.datetime.end_time / 60);
      if (startH < minHour) minHour = startH;
      if (endH > maxHour) maxHour = endH;
    }
  }
  if (minHour >= maxHour) { minHour = 7; maxHour = 22; }
  minHour = Math.max(6, minHour - 1);
  maxHour = Math.min(24, maxHour + 1);

  // Modern soft colors
  const colors = [
    { bg: "#00a884", text: "#ffffff" }, // Teky Green
    { bg: "#fbbc05", text: "#ffffff" }, // Yellow
    { bg: "#4285f4", text: "#ffffff" }, // Blue
    { bg: "#ea4335", text: "#ffffff" }, // Red
    { bg: "#8e24aa", text: "#ffffff" }, // Purple
    { bg: "#f06292", text: "#ffffff" }, // Pink
  ];

  let timeSlotsHtml = "";
  for (let h = minHour; h <= maxHour; h++) {
    timeSlotsHtml += `<div class="time-slot" style="top: ${(h - minHour) * 80}px"><span>${String(h).padStart(2, "0")}:00</span></div>`;
  }

  const totalHeight = (maxHour - minHour) * 80;
  let columnsHtml = "";

  for (let i = 0; i < 7; i++) {
    const day = days[i];
    const isToday = i === todayIdx;

    let sessionsHtml = "";
    day.sessions.forEach((s, idx) => {
      // Determine color based on some hash of class name to keep it consistent
      const colorHash = (s.class_name || "").length % colors.length;
      const color = colors[colorHash];
      const topPx = ((s.datetime.start_time / 60) - minHour) * 80;
      const heightPx = ((s.datetime.end_time - s.datetime.start_time) / 60) * 80;
      const formatMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const timeStr = `${formatMin(s.datetime.start_time)} - ${formatMin(s.datetime.end_time)}`;

      sessionsHtml += `
        <a href="/session/${s.session_id}" class="session-block" style="
          top: ${topPx}px;
          height: ${Math.max(heightPx - 2, 30)}px;
          background-color: ${color.bg};
          color: ${color.text};
        ">
          <div class="session-time">${timeStr}</div>
          <div class="session-name">${s.class_name || "Lớp học"}</div>
          <div class="session-chapter">${s.session_chapter || ""}</div>
        </a>
      `;
    });

    columnsHtml += `
      <div class="day-column ${isToday ? 'today' : ''}">
        <div class="day-header ${isToday ? 'today' : ''}">
          <div class="day-name">${day.name}</div>
          <div class="day-date">${day.dateStr}</div>
        </div>
        <div class="day-body" style="height: ${totalHeight}px">
          ${Array.from({ length: maxHour - minHour }, (_, j) =>
            `<div class="hour-line" style="top: ${j * 80}px"></div>`
          ).join("")}
          ${sessionsHtml}
          ${isToday ? `<div class="now-line" style="top: ${(((today.getHours() * 60 + today.getMinutes()) / 60) - minHour) * 80}px"></div>` : ''}
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TutorO Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #f8f9fa;
      color: #202124;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Header */
    .top-bar {
      background: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e0e0e0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      flex-shrink: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .top-bar h1 {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
    }
    .week-info {
      font-size: 14px;
      color: #6b7280;
      font-weight: 500;
      background: #f3f4f6;
      padding: 6px 12px;
      border-radius: 6px;
    }
    .header-actions { display: flex; gap: 10px; }
    .header-btn {
      padding: 8px 16px;
      border: 1px solid #e5e7eb;
      background: #ffffff;
      color: #374151;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .header-btn:hover { background: #f9fafb; border-color: #d1d5db; }
    .header-btn.primary { background: #00a884; color: white; border-color: #00a884; }
    .header-btn.primary:hover { background: #008f6f; }

    /* Calendar */
    .calendar-container {
      flex: 1;
      display: flex;
      overflow-y: auto;
      overflow-x: auto;
      background: #ffffff;
      padding-bottom: 40px;
    }
    .time-gutter {
      min-width: 60px;
      border-right: 1px solid #f0f0f0;
      position: sticky;
      left: 0;
      background: #ffffff;
      z-index: 10;
    }
    .time-gutter-header { height: 70px; border-bottom: 1px solid #f0f0f0; }
    .time-gutter-body { position: relative; }
    .time-slot {
      position: absolute;
      width: 100%;
      text-align: center;
      transform: translateY(-50%);
    }
    .time-slot span {
      font-size: 11px;
      color: #70757a;
      font-weight: 500;
      background: #fff;
      padding: 0 4px;
    }

    .day-column {
      flex: 1;
      min-width: 150px;
      border-right: 1px solid #f0f0f0;
    }
    .day-header {
      height: 70px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #f0f0f0;
      position: sticky;
      top: 0;
      background: #ffffff;
      z-index: 5;
    }
    .day-name { font-size: 11px; color: #70757a; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .day-date { font-size: 20px; color: #3c4043; font-weight: 400; }
    
    .day-header.today .day-name { color: #1a73e8; }
    .day-header.today .day-date { 
      background: #1a73e8; 
      color: #fff; 
      width: auto; 
      padding: 0 10px;
      height: 32px; 
      border-radius: 16px; 
      display: inline-flex; 
      align-items: center; 
      justify-content: center; 
      font-weight: 600;
      font-size: 14px;
    }
    
    .day-body { position: relative; padding: 0 4px; }
    .hour-line {
      position: absolute; left: 0; right: 0; height: 1px; background: #f0f0f0;
    }

    /* Sessions */
    .session-block {
      position: absolute;
      left: 4px;
      right: 4px;
      border-radius: 6px;
      padding: 6px 8px;
      overflow: hidden;
      cursor: pointer;
      text-decoration: none;
      transition: box-shadow 0.2s;
      z-index: 2;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .session-block:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      z-index: 3;
    }
    .session-time { font-size: 10px; font-weight: 600; margin-bottom: 2px; opacity: 0.9; }
    .session-name { font-size: 12px; font-weight: 700; line-height: 1.2; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .session-chapter { font-size: 11px; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Current time indicator */
    .now-line {
      position: absolute; left: 0; right: 0; height: 2px; background: #ea4335; z-index: 4; pointer-events: none;
    }
    .now-line::before {
      content: ''; position: absolute; left: -4px; top: -4px; width: 10px; height: 10px; background: #ea4335; border-radius: 50%;
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="brand">
      <h1>TutorO Calendar</h1>
      <div class="week-info">${monday} — ${sunday}</div>
    </div>
    <div class="header-actions">
      <button class="header-btn" onclick="setAllMode(1)">Tất cả Bình thường</button>
      <button class="header-btn" onclick="setAllMode(2)">Tất cả Tích cực</button>
      <button class="header-btn primary" onclick="location.reload()">Làm mới</button>
    </div>
  </div>

  <div class="calendar-container">
    <div class="time-gutter">
      <div class="time-gutter-header"></div>
      <div class="time-gutter-body" style="height: ${totalHeight}px">
        ${timeSlotsHtml}
      </div>
    </div>
    ${columnsHtml}
  </div>

  <script>
    setTimeout(() => location.reload(), 120000);
    const allSessionIds = ${JSON.stringify(sessions.map(s => s.session_id))};
    function setAllMode(mode) {
      Promise.all(allSessionIds.map(id => fetch('/api/set-mode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id, mode })
      }))).then(() => alert('Đã áp dụng!'));
    }
  </script>
</body>
</html>`;
}

function renderSessionDetailPage(session, checkinStatus, evalMode) {
  const formatMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const timeStr = `${formatMin(session.datetime.start_time)} - ${formatMin(session.datetime.end_time)}`;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const checkinWindowStart = session.datetime.start_time - 15;
  let status, statusLabel, statusColor, statusIcon;

  if (checkinStatus && checkinStatus.checkin_id) {
    status = "checked_in";
    statusLabel = "Đã Check-in";
    statusColor = "#10b981"; // Emerald green
    statusIcon = "✅";
  } else if (currentMinutes < checkinWindowStart) {
    status = "waiting";
    statusLabel = "Chờ Check-in";
    statusColor = "#f59e0b"; // Amber
    statusIcon = "⏳";
  } else if (currentMinutes >= checkinWindowStart && currentMinutes <= session.datetime.start_time + 30) {
    status = "ready";
    statusLabel = "Sẵn sàng Check-in";
    statusColor = "#3b82f6"; // Blue
    statusIcon = "🔔";
  } else {
    status = "missed";
    statusLabel = "Đã qua giờ / Thất bại";
    statusColor = "#ef4444"; // Red
    statusIcon = "⚠️";
  }

  const failedInfo = failedCheckins.get(String(session.session_id));
  const canRetry = failedInfo ? (Date.now() - failedInfo.failedAt >= 5 * 60 * 1000) : false;
  const evalReady = currentMinutes >= session.datetime.end_time + 5;

  let checkinTimeInfo = "";
  if (checkinStatus && checkinStatus.checkin_datetime) {
    const cDate = new Date(checkinStatus.checkin_datetime * 1000);
    checkinTimeInfo = `${String(cDate.getHours()).padStart(2, "0")}:${String(cDate.getMinutes()).padStart(2, "0")}`;
  }

  const waitMinutes = checkinWindowStart - currentMinutes;
  const modeNames = { 0: "Không đánh giá", 1: "Bình thường", 2: "Tích cực" };
  const modeName = modeNames[evalMode] || "Bình thường";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${session.class_name} — Chi tiết</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --danger: #dc2626;
      --danger-hover: #b91c1c;
      --success: #16a34a;
      --bg-color: #f3f4f6;
      --card-bg: #ffffff;
      --text-main: #111827;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg-color);
      color: var(--text-main);
      line-height: 1.5;
      min-height: 100vh;
    }

    .navbar {
      background: var(--card-bg);
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .back-btn {
      text-decoration: none;
      color: var(--text-muted);
      font-weight: 500;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .back-btn:hover { color: var(--text-main); }

    .main-container {
      max-width: 640px;
      margin: 32px auto;
      padding: 0 16px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Cards */
    .card {
      background: var(--card-bg);
      border-radius: 12px;
      border: 1px solid var(--border-color);
      padding: 24px;
    }

    /* Header */
    .class-title { font-size: 20px; font-weight: 600; color: var(--text-main); margin-bottom: 4px; }
    .class-meta { font-size: 14px; color: var(--text-muted); }

    /* Status Section */
    .status-area {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .status-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      flex-shrink: 0;
      background: #f3f4f6;
    }
    .status-content { flex: 1; }
    .status-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: var(--status-color); }
    .status-desc { font-size: 14px; color: var(--text-muted); margin-bottom: 16px; }
    
    .countdown-timer { font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 4px; color: #d97706; }
    
    .error-box {
      background: #fef2f2;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
    }
    .error-text { color: var(--danger); font-weight: 500; font-size: 14px; margin-bottom: 12px; }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-danger { background: var(--danger); color: white; }
    .btn-danger:hover:not(:disabled) { background: var(--danger-hover); }
    .btn-outline { background: white; color: var(--text-main); border-color: #d1d5db; }
    .btn-outline:hover:not(:disabled) { background: #f9fafb; }
    .btn-block { width: 100%; }

    /* Evaluation */
    .eval-header { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    .eval-badge { font-size: 12px; font-weight: 500; background: #f3f4f6; padding: 2px 8px; border-radius: 12px; color: var(--text-muted); }
    
    .mode-group { display: flex; gap: 8px; margin-bottom: 20px; }
    .mode-btn {
      flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: white;
      font-size: 13px; font-weight: 500; color: var(--text-muted); cursor: pointer; transition: all 0.15s;
      text-align: center;
    }
    .mode-btn:hover { border-color: #9ca3af; color: var(--text-main); }
    .mode-btn.active-1 { border-color: var(--success); background: #f0fdf4; color: var(--success); }
    .mode-btn.active-2 { border-color: #d97706; background: #fffbeb; color: #d97706; }
    .mode-btn.active-0 { border-color: var(--danger); background: #fef2f2; color: var(--danger); }

    /* Toast */
    .toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(100px);
      background: #1f2937; color: white; padding: 12px 24px; border-radius: 8px;
      font-weight: 500; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      transition: transform 0.2s ease-out; z-index: 1000;
    }
    .toast.show { transform: translateX(-50%) translateY(0); }
  </style>
</head>
<body>
  <div class="navbar">
    <a href="/" class="back-btn">
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
      Trở về Lịch tuần
    </a>
  </div>

  <div class="main-container">
    <div class="card">
      <h1 class="class-title">${session.class_name || "Lớp học"}</h1>
      <div class="class-meta">${timeStr} • ${session.session_chapter || "Không có thông tin bài học"}</div>
    </div>

    <!-- Status Card -->
    <div class="card" style="--status-color: ${statusColor}">
      <div class="status-area">
        <div class="status-icon-wrap" style="color: ${statusColor}; background: ${statusColor}15;">
          ${statusIcon}
        </div>
        <div class="status-content">
          <div class="status-title">${statusLabel}</div>
          
          ${status === "waiting" ? `
            <div class="status-desc">Hệ thống sẽ tự động check-in vào lúc <strong>${formatMin(checkinWindowStart)}</strong></div>
            <div class="countdown-timer" id="countdown">${Math.floor(waitMinutes / 60)}:${String(waitMinutes % 60).padStart(2, '0')}:00</div>
          ` : ""}

          ${status === "ready" ? `
            <div class="status-desc">Cổng check-in đã mở. Hệ thống đang tiến hành xử lý tự động.</div>
            <button class="btn btn-outline" id="btnCheckin" onclick="doCheckin()">Check-in Thủ công</button>
          ` : ""}

          ${status === "checked_in" ? `
            <div class="status-desc">
              ${checkinTimeInfo ? `Xác nhận thành công lúc <strong>${checkinTimeInfo}</strong>` : ""}
              ${checkinStatus.state ? `<br>Trạng thái: ${checkinStatus.state}` : ""}
            </div>
            <button class="btn btn-outline" style="font-size: 13px; padding: 6px 12px;" onclick="doCheckin()">Kiểm tra lại trạng thái</button>
          ` : ""}

          ${status === "missed" && !failedInfo ? `
            <div class="status-desc">Đã quá thời gian quy định hoặc có lỗi không mong muốn.</div>
            <button class="btn btn-danger" onclick="doCheckin()">Thử lại Check-in</button>
          ` : ""}

          ${failedInfo ? `
            <div class="error-box">
              <div class="error-text">Check-in không thành công (Thử lại lần ${failedInfo.retryCount || 1})</div>
              ${canRetry ? `
                <button class="btn btn-danger btn-block" onclick="doCheckin()">Thử lại ngay</button>
              ` : `
                <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Tự động thử lại sau:</div>
                <div class="countdown-timer" id="retryCountdown" style="color: var(--danger); font-size: 20px;">--:--</div>
              `}
            </div>
          ` : ""}
        </div>
      </div>
    </div>

    <!-- Evaluation Card -->
    <div class="card">
      <div class="eval-header">
        Chế độ đánh giá
        ${!evalReady ? '<span class="eval-badge">Mở khóa sau buổi học</span>' : '<span class="eval-badge" style="background:#dcfce7;color:#166534">Sẵn sàng</span>'}
      </div>
      
      <div class="mode-group">
        <button class="mode-btn ${evalMode === 1 ? 'active-1' : ''}" onclick="setMode(1)">Bình thường</button>
        <button class="mode-btn ${evalMode === 2 ? 'active-2' : ''}" onclick="setMode(2)">Tích cực</button>
        <button class="mode-btn ${evalMode === 0 ? 'active-0' : ''}" onclick="setMode(0)">Bỏ qua</button>
      </div>

      <button class="btn btn-primary btn-block" id="btnEval" onclick="evaluateNow()" ${!evalReady ? 'disabled' : ''}>
        Gửi Đánh Giá (${modeName})
      </button>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const SESSION_ID = '${session.session_id}';
    const FAILED_AT = ${failedInfo ? failedInfo.failedAt : 0};
    const RETRY_AFTER_MS = 5 * 60 * 1000;

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3000);
    }

    ${status === "waiting" ? `
    setInterval(() => {
      const targetMin = ${checkinWindowStart};
      const now = new Date();
      const left = (targetMin - (now.getHours() * 60 + now.getMinutes())) * 60 - now.getSeconds();
      if (left <= 0) location.reload();
      else {
        const h = Math.floor(left / 3600);
        const m = Math.floor((left % 3600) / 60);
        const s = left % 60;
        const el = document.getElementById('countdown');
        if(el) el.textContent = (h > 0 ? h + ':' : '') + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
      }
    }, 1000);
    ` : ""}

    ${failedInfo && !canRetry ? `
    setInterval(() => {
      const rem = Math.max(0, RETRY_AFTER_MS - (Date.now() - FAILED_AT));
      if (rem <= 0) location.reload();
      else {
        const el = document.getElementById('retryCountdown');
        if(el) el.textContent = String(Math.floor(rem/60000)).padStart(2,'0') + ':' + String(Math.floor((rem%60000)/1000)).padStart(2,'0');
      }
    }, 1000);
    ` : ""}

    async function doCheckin() {
      showToast('Đang xử lý...');
      try {
        const res = await fetch('/api/checkin-now', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: SESSION_ID })
        });
        const data = await res.json();
        showToast(data.message || data.error);
        setTimeout(() => location.reload(), 1500);
      } catch (e) {
        showToast('Lỗi: ' + e.message);
      }
    }

    async function setMode(mode) {
      await fetch('/api/set-mode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: SESSION_ID, mode })
      });
      location.reload();
    }

    async function evaluateNow() {
      if (!confirm('Xác nhận gửi đánh giá?')) return;
      showToast('Đang gửi...');
      try {
        const res = await fetch('/api/evaluate-now', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: SESSION_ID })
        });
        const data = await res.json();
        showToast(data.message || data.error);
        setTimeout(() => location.reload(), 2000);
      } catch (e) { showToast('Lỗi: ' + e.message); }
    }
  </script>
</body>
</html>`;
}

// ─── HTTP Server ───────────────────────────────────────────

export function startServer() {
  const PORT = process.env.PORT || 3000;

  const server = http.createServer(async (req, res) => {
    // Health check
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
      return;
    }

    // API: Cập nhật chế độ đánh giá
    if (req.method === "POST" && req.url === "/api/set-mode") {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (data.sessionId != null && data.mode != null) {
            evalModes.set(String(data.sessionId), parseInt(data.mode));
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "Thiếu dữ liệu" }));
          }
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Lỗi phân tích JSON" }));
        }
      });
      return;
    }

    // API: Check-in thủ công
    if (req.method === "POST" && req.url === "/api/checkin-now") {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          if (!data.sessionId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Thiếu sessionId" }));
            return;
          }

          // Thử check-in
          try {
            const apiRes = await fetch(`${API_BASE}/class_sessions/${data.sessionId}/checkin`, {
              method: "POST",
              headers: { Authorization: `Bearer ${TOKEN}` },
            });
            const text = await apiRes.text();
            const json = JSON.parse(text);

            if (apiRes.ok && json.message?.status_code === 200) {
              // Thành công → xóa trạng thái failed
              failedCheckins.delete(String(data.sessionId));
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                success: true,
                message: `Check-in thành công! Trạng thái: ${json.data.state}`
              }));
              return;
            }

            if (json.message?.text?.includes("đã check in")) {
              failedCheckins.delete(String(data.sessionId));
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: true, message: "Đã check-in trước đó rồi!" }));
              return;
            }

            // Thất bại → lưu lại để retry
            const existing = failedCheckins.get(String(data.sessionId));
            failedCheckins.set(String(data.sessionId), {
              failedAt: Date.now(),
              retryCount: (existing?.retryCount || 0) + 1,
              error: json.message?.text || "Lỗi không xác định"
            });

            // Tự động retry sau 5 phút
            setTimeout(async () => {
              console.log(`[RETRY] Tự động retry check-in cho session ${data.sessionId}...`);
              try {
                const retryRes = await fetch(`${API_BASE}/class_sessions/${data.sessionId}/checkin`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${TOKEN}` },
                });
                const retryText = await retryRes.text();
                const retryJson = JSON.parse(retryText);
                if (retryRes.ok && retryJson.message?.status_code === 200) {
                  console.log(`[RETRY] Check-in thành công cho session ${data.sessionId}!`);
                  failedCheckins.delete(String(data.sessionId));
                } else if (retryJson.message?.text?.includes("đã check in")) {
                  console.log(`[RETRY] Session ${data.sessionId} đã check-in rồi.`);
                  failedCheckins.delete(String(data.sessionId));
                } else {
                  console.log(`[RETRY] Vẫn thất bại: ${retryJson.message?.text}`);
                  const info = failedCheckins.get(String(data.sessionId));
                  if (info) info.failedAt = Date.now(); // Reset timer
                }
              } catch (e) {
                console.log(`[RETRY] Lỗi retry: ${e.message}`);
              }
            }, 5 * 60 * 1000);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              success: false,
              error: `Check-in thất bại: ${json.message?.text}. Sẽ tự động thử lại sau 5 phút.`
            }));
          } catch (err) {
            const existing = failedCheckins.get(String(data.sessionId));
            failedCheckins.set(String(data.sessionId), {
              failedAt: Date.now(),
              retryCount: (existing?.retryCount || 0) + 1,
              error: err.message
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              success: false,
              error: `Lỗi: ${err.message}. Sẽ tự động thử lại sau 5 phút.`
            }));
          }
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Lỗi phân tích JSON" }));
        }
      });
      return;
    }

    // API: Đánh giá ngay lập tức
    if (req.method === "POST" && req.url === "/api/evaluate-now") {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          if (!data.sessionId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Thiếu sessionId" }));
            return;
          }

          const mode = getEvalMode(data.sessionId);
          if (mode === 0) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, message: "Lớp này đang ở chế độ Không đánh giá. Hãy đổi chế độ trước." }));
            return;
          }

          const payloadTemplate = mode === 2 ? EVAL_PAYLOAD_HIGH : EVAL_PAYLOAD_NORMAL;
          const students = await getEvaluationStudents(data.sessionId);
          const absentIds = await getAbsentStudentIds(data.sessionId);

          let evalSuccess = 0, alreadyEval = 0, evalFail = 0, skippedAbsent = 0;

          for (const student of students) {
            if (student.evaluation_info?.evaluation_status === true) {
              alreadyEval++;
              continue;
            }
            if (absentIds.has(student.student_id)) {
              skippedAbsent++;
              continue;
            }
            const payload = JSON.parse(JSON.stringify(payloadTemplate));
            const ok = await submitEvaluation(data.sessionId, student.student_id, payload);
            if (ok) evalSuccess++; else evalFail++;
            await sleep(1500);
          }

          const modeNameStr = mode === 2 ? "Tích Cực" : "Bình Thường";
          console.log(`[DANH GIA NGAY] Session ${data.sessionId}: TC=${evalSuccess}, DaDG=${alreadyEval}, Nghi=${skippedAbsent}, Loi=${evalFail} (${modeNameStr})`);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            message: `Đánh giá xong! Thành công: ${evalSuccess}, Đã DG trước: ${alreadyEval}, Nghỉ học: ${skippedAbsent}, Lỗi: ${evalFail} (Chế độ: ${modeNameStr})`
          }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // API: Lấy trạng thái session (cho polling)
    if (req.method === "GET" && req.url.startsWith("/api/session-status/")) {
      const sessionId = req.url.split("/api/session-status/")[1];
      try {
        const status = await getCheckinStatus(sessionId);
        const failed = failedCheckins.get(String(sessionId));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          checkedIn: !!(status && status.checkin_id),
          checkinData: status,
          failed: failed || null,
          evalMode: getEvalMode(sessionId),
        }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // Trang chi tiết session
    const sessionMatch = req.url.match(/^\/session\/(\d+)$/);
    if (req.method === "GET" && sessionMatch) {
      const sessionId = sessionMatch[1];
      try {
        const sessions = await getSessionsToday();
        let session = sessions.find(s => String(s.session_id) === sessionId);

        // Nếu không tìm trong hôm nay, thử tìm trong tuần
        if (!session) {
          const weekData = await getSessionsWeek();
          session = weekData.sessions.find(s => String(s.session_id) === sessionId);
        }

        if (!session) {
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h1>Không tìm thấy lớp học</h1><a href='/'>← Quay về</a>");
          return;
        }

        // Auto-set Camp / STEM classes to mode 0
        const nameLower = (session.class_name || "").toLowerCase();
        const isCamp = nameLower.includes("camp");
        const isStemSchool = nameLower.includes("stem") && (nameLower.includes("tiểu học") || nameLower.includes("thcs") || nameLower.includes("trung học"));
        if ((isCamp || isStemSchool) && !evalModes.has(String(session.session_id))) {
          evalModes.set(String(session.session_id), 0);
        }

        const checkinStatus = await getCheckinStatus(sessionId);
        const evalMode = getEvalMode(sessionId);

        const html = renderSessionDetailPage(session, checkinStatus, evalMode);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      } catch (e) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Lỗi: " + e.message);
      }
      return;
    }

    // Trang chính: Weekly Calendar
    if ((req.method === "GET" || req.method === "HEAD") && req.url === "/") {
      if (req.method === "HEAD") {
        res.writeHead(200);
        res.end();
        return;
      }
      try {
        const weekData = await getSessionsWeek();
        const todaySessions = await getSessionsToday();

        // Auto-set modes cho Camp / STEM
        for (const s of weekData.sessions) {
          const nameLower = (s.class_name || "").toLowerCase();
          const isCamp = nameLower.includes("camp");
          const isStemSchool = nameLower.includes("stem") && (nameLower.includes("tiểu học") || nameLower.includes("thcs") || nameLower.includes("trung học"));
          if ((isCamp || isStemSchool) && !evalModes.has(String(s.session_id))) {
            evalModes.set(String(s.session_id), 0);
          }
        }

        const html = renderWeeklyCalendarPage(weekData, todaySessions);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      } catch (e) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Lỗi khi tải danh sách lớp học: " + e.message);
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Không tìm thấy trang");
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Web Dashboard dang chay tren port ${PORT}`);
    console.log(`Truy cap link Render cua ban de vao Bang dieu khien`);
  });
}
