import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Agent Usage",
  version: "0.1.0",
  description:
    "Track AI subscription usage for Codex, Claude, and Cursor — credentials stay on your device.",
  icons: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  permissions: ["storage", "alarms", "cookies"],
  host_permissions: [
    "https://cursor.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://api.anthropic.com/*",
    "https://api.github.com/*",
  ],
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Agent Usage",
    default_icon: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
});
