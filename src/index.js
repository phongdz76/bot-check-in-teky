require("./config"); // Khởi tạo config và timezone
const { sendDiscord } = require("./services/discord");
const { processToday } = require("./core/checkin");
const { startServer } = require("./server");
const { msUntilTomorrow6AM, formatDuration, sleep } = require("./utils/time");

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║   TutorO Auto Check-in — CHE DO 24/7      ║");
  console.log("║   Tu dong check-in moi ngay               ║");
  console.log("║   Nhan Ctrl+C de dung                     ║");
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

// Bật Web server mini
startServer();

// Khởi chạy vòng lặp chính
main();
