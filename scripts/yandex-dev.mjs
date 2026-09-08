import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { yandexProxySpawnSpec } from "./yandex-proxy-command.mjs";
import { findAvailablePort } from "./yandex-dev-port.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const viteEntry = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const viteHost = "127.0.0.1";
const vitePort = 5173;
const preferredProxyPort = 8080;
const upstream = `http://${viteHost}:${vitePort}`;

const children = new Set();
let shuttingDown = false;

function start(command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

async function waitForVite() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(upstream, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite did not become reachable at ${upstream}`);
}

process.once("SIGINT", () => {
  stopAll();
  process.exitCode = 130;
});
process.once("SIGTERM", () => {
  stopAll();
  process.exitCode = 143;
});

const vite = start(process.execPath, [
  viteEntry,
  "--host",
  viteHost,
  "--port",
  String(vitePort),
  "--strictPort",
]);

vite.once("exit", (code) => {
  if (shuttingDown) return;
  stopAll();
  process.exitCode = code ?? 1;
});

try {
  await waitForVite();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stopAll();
  process.exitCode = 1;
  process.exit();
}

const proxyPort = await findAvailablePort(preferredProxyPort);
if (proxyPort !== preferredProxyPort) {
  console.log(`[Garden] Port ${preferredProxyPort} is busy; using Yandex proxy port ${proxyPort}.`);
}
console.log(`[Garden] Starting official Yandex Games SDK dev proxy on http://127.0.0.1:${proxyPort}/ ...`);
const proxyArgs = [
  "--yes",
  "@yandex-games/sdk-dev-proxy@0.0.2",
  "-h",
  upstream,
  "--dev-mode=true",
  `--port=${proxyPort}`,
];
const proxySpawn = yandexProxySpawnSpec(process.platform, process.env, proxyArgs);
const proxy = start(proxySpawn.command, proxySpawn.args);

proxy.once("exit", (code) => {
  if (shuttingDown) return;
  stopAll();
  process.exitCode = code ?? 1;
});
