import http from "http";
import { getSessionsToday } from "./services/tutoro.js";
import { formatDuration } from "./utils/time.js";

// Lưu trữ chế độ đánh giá cho từng buổi học (1: Bình thường, 2: Tích cực)
// Mặc định là 1 nếu không có.
const evalModes = new Map();

export function getEvalMode(sessionId) {
  return evalModes.get(String(sessionId)) || 1;
}

export function startServer() {
  const PORT = process.env.PORT || 3000;

  const server = http.createServer(async (req, res) => {
    // API Cập nhật chế độ đánh giá
    if (req.method === "POST" && req.url === "/api/set-mode") {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (data.sessionId && data.mode) {
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
            const mode = getEvalMode(s.session_id);
            const startStr = formatDuration(s.datetime.start_time * 60); // or minutesToTimeStr
            // wait, we can just use a quick helper to format minutes
            const formatMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
            const timeStr = `${formatMin(s.datetime.start_time)} - ${formatMin(s.datetime.end_time)}`;
            sessionCards += `
              <div class="card">
                <h3>${s.class_name || "Lớp học"} (${timeStr})</h3>
                <p>Bài: ${s.session_chapter || "Không có tên bài"}</p>
                <div class="mode-toggles">
                  <button class="btn ${mode === 1 ? 'active' : ''}" onclick="setMode('${s.session_id}', 1)">Bình thường</button>
                  <button class="btn ${mode === 2 ? 'active' : ''}" onclick="setMode('${s.session_id}', 2)">Tích cực</button>
                </div>
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
