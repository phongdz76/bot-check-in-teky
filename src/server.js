import http from "http";
import { getSessionsToday, getEvaluationStudents, submitEvaluation, getAbsentStudentIds } from "./services/tutoro.js";
import { formatDuration, sleep } from "./utils/time.js";
import { EVAL_PAYLOAD_NORMAL, EVAL_PAYLOAD_HIGH } from "./core/evalData.js";

// Lưu trữ chế độ đánh giá cho từng buổi học (1: Bình thường, 2: Tích cực)
// Mặc định là 1 nếu không có.
const evalModes = new Map();

export function getEvalMode(sessionId) {
  const key = String(sessionId);
  return evalModes.has(key) ? evalModes.get(key) : 1;
}

export function startServer() {
  const PORT = process.env.PORT || 3000;

  const server = http.createServer(async (req, res) => {
    // Health check endpoint — trả về 200 ngay lập tức, không gọi API nào
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
      return;
    }

    // API Cập nhật chế độ đánh giá
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

    // API Đánh giá ngay lập tức
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

          const modeName = mode === 2 ? "Tích Cực" : "Bình Thường";
          console.log(`[DANH GIA NGAY] Session ${data.sessionId}: TC=${evalSuccess}, DaDG=${alreadyEval}, Nghi=${skippedAbsent}, Loi=${evalFail} (${modeName})`);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            message: `Đánh giá xong! Thành công: ${evalSuccess}, Đã DG trước: ${alreadyEval}, Nghỉ học: ${skippedAbsent}, Lỗi: ${evalFail} (Chế độ: ${modeName})`
          }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Giao diện Web Dashboard (Hỗ trợ cả GET và HEAD cho UptimeRobot)
    if ((req.method === "GET" || req.method === "HEAD") && req.url === "/") {
      if (req.method === "HEAD") {
        res.writeHead(200);
        res.end();
        return;
      }
      try {
        const sessions = await getSessionsToday();
        
        let sessionCards = "";
        if (sessions.length === 0) {
          sessionCards = `<div class="card"><p>Hôm nay không có ca dạy nào!</p></div>`;
        } else {
          sessions.forEach(s => {
            const nameLower = (s.class_name || "").toLowerCase();
            // Lớp Camp tự động đặt mode = 0 nếu chưa được set
            const isCamp = nameLower.includes("camp");
            // Lớp STEM tiểu học/THCS tự động đặt mode = 0 nếu chưa được set
            const isStemSchool = nameLower.includes("stem") && (nameLower.includes("tiểu học") || nameLower.includes("thcs") || nameLower.includes("trung học"));
            if ((isCamp || isStemSchool) && !evalModes.has(String(s.session_id))) {
              evalModes.set(String(s.session_id), 0);
            }
            const mode = getEvalMode(s.session_id);
            const formatMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
            const timeStr = `${formatMin(s.datetime.start_time)} - ${formatMin(s.datetime.end_time)}`;
            sessionCards += `
              <div class="card">
                <h3>${s.class_name || "Lớp học"} (${timeStr})</h3>
                <p>Bài: ${s.session_chapter || "Không có tên bài"}</p>
                <div class="mode-toggles">
                  <button class="btn ${mode === 1 ? 'active' : ''}" onclick="setMode('${s.session_id}', 1)">Bình thường</button>
                  <button class="btn ${mode === 2 ? 'active' : ''}" onclick="setMode('${s.session_id}', 2)">Tích cực</button>
                  <button class="btn btn-skip ${mode === 0 ? 'active' : ''}" onclick="setMode('${s.session_id}', 0)">Không đánh giá</button>
                </div>
                <button class="btn btn-eval" onclick="evaluateNow('${s.session_id}')">Đánh giá ngay</button>
              </div>
            `;
          });
        }

        const html = `
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TutorO Auto - Bảng Điều Khiển</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #121212; color: #fff; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; }
              h1 { text-align: center; color: #bb86fc; }
              .card { background: #1e1e1e; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
              .card h3 { margin-top: 0; color: #03dac6; }
              .card p { font-size: 14px; color: #b3b3b3; }
              .mode-toggles { display: flex; gap: 10px; margin-top: 15px; }
              .btn { flex: 1; padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; background: #333; color: #fff; transition: 0.3s; }
              .btn.active { background: #bb86fc; color: #000; }
              .btn-skip.active { background: #cf6679; color: #000; }
              .btn-eval { margin-top: 10px; background: #ff9800; color: #000; width: 100%; }
              .btn-eval:hover { background: #ffb74d; }
              .header-actions { display: flex; gap: 10px; margin-bottom: 20px; }
              .header-actions .btn { background: #03dac6; color: #000; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>TutorO Bảng Điều Khiển</h1>
              <p style="text-align: center; color: #888;">Bấm để chọn chế độ đánh giá cho các lớp hôm nay</p>
              
              <div class="header-actions">
                <button class="btn" onclick="setAll(1)">Tất cả Bình thường</button>
                <button class="btn" onclick="setAll(2)">Tất cả Tích cực</button>
              </div>

              ${sessionCards}
            </div>

            <script>
              function setMode(sessionId, mode) {
                fetch('/api/set-mode', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId, mode })
                }).then(() => location.reload());
              }

              function setAll(mode) {
                const sessionIds = ${JSON.stringify(sessions ? sessions.map(s => s.session_id) : [])};
                Promise.all(sessionIds.map(id => fetch('/api/set-mode', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: id, mode })
                }))).then(() => location.reload());
              }

              function evaluateNow(sessionId) {
                if (!confirm('Bạn có chắc muốn đánh giá lớp này ngay bây giờ?')) return;
                const btn = event.target;
                btn.disabled = true;
                btn.textContent = 'Đang đánh giá...';
                fetch('/api/evaluate-now', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId })
                })
                .then(r => r.json())
                .then(data => {
                  alert(data.message || data.error);
                  location.reload();
                })
                .catch(err => {
                  alert('Lỗi: ' + err.message);
                  btn.disabled = false;
                  btn.textContent = 'Đánh giá ngay';
                });
              }
            </script>
          </body>
          </html>
        `;
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
