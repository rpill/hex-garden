import net from "node:net";

const MAX_PORT = 65_535;
const MAX_ATTEMPTS = 100;

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ port }, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findAvailablePort(preferredPort) {
  if (!Number.isSafeInteger(preferredPort) || preferredPort < 1 || preferredPort > MAX_PORT) {
    throw new RangeError(`Invalid preferred port: ${preferredPort}`);
  }

  const endPort = Math.min(MAX_PORT, preferredPort + MAX_ATTEMPTS - 1);
  for (let port = preferredPort; port <= endPort; port += 1) {
    if (await canListen(port)) return port;
  }

  throw new Error(`No free port found in range ${preferredPort}-${endPort}`);
}
