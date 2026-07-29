// Compiles whisper.cpp and downloads the base.en model — run once during the
// Docker build (see Dockerfile), not at runtime. Calls nodejs-whisper's own
// autoDownloadModel() directly rather than `npx nodejs-whisper download`,
// which prompts interactively and fails in any non-TTY environment (a Docker
// build included) — same fix already proven working on this Mac locally.
const autoDownloadModel = require("nodejs-whisper/dist/autoDownloadModel.js").default;

autoDownloadModel(console, "base.en", false)
  .then((message) => {
    console.log("[build-whisper]", message);
  })
  .catch((error) => {
    console.error("[build-whisper] Failed:", error);
    process.exit(1);
  });
