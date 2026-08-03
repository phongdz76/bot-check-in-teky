const http = require("http");

function startServer() {
  const PORT = process.env.PORT || 3000;

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("TutorO Bot is running 24/7!\n");
  });

  server.listen(PORT, () => {
    console.log(`\n Web server mini dang chay tren port ${PORT}`);
    console.log(`Dung UptimeRobot ping vao server nay de giu bot thuc 24/7\n`);
  });
}

module.exports = { startServer };
