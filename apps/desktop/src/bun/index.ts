import { BrowserWindow, Updater } from "electrobun/main";

const DEV_SERVER_PORT = 3007;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using web dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Web dev server not running. Run dev:hmr for live reload.");
    }
  }

  return "views://mainview/index.html";
}

const url = await getMainViewUrl();

new BrowserWindow({
  title: "daan",
  url,
  preload: url.startsWith("views://") ? 'history.replaceState(null, "", "/");' : undefined,
  frame: {
    width: 1280,
    height: 820,
    x: 120,
    y: 120,
  },
});

console.log("Electrobun desktop shell started.");
