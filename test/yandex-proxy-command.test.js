import test from "node:test";
import assert from "node:assert/strict";
import { yandexProxySpawnSpec } from "../scripts/yandex-proxy-command.mjs";

const proxyArgs = [
  "--yes",
  "@yandex-games/sdk-dev-proxy@0.0.2",
  "-h",
  "http://127.0.0.1:5173",
  "--dev-mode=true",
  "--port=8080",
];

test("Windows launches npx.cmd through ComSpec instead of spawning the cmd file directly", () => {
  const spec = yandexProxySpawnSpec("win32", { ComSpec: "C:\\Windows\\System32\\cmd.exe" }, proxyArgs);

  assert.equal(spec.command, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(spec.args, ["/d", "/s", "/c", "npx.cmd", ...proxyArgs]);
});

test("POSIX launches npx directly", () => {
  const spec = yandexProxySpawnSpec("linux", {}, proxyArgs);

  assert.equal(spec.command, "npx");
  assert.deepEqual(spec.args, proxyArgs);
});
