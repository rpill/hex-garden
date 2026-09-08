export function yandexProxySpawnSpec(platform, env, args) {
  if (platform === "win32") {
    return {
      command: env.ComSpec ?? env.COMSPEC ?? "cmd.exe",
      args: ["/d", "/s", "/c", "npx.cmd", ...args],
    };
  }

  return {
    command: "npx",
    args: [...args],
  };
}
