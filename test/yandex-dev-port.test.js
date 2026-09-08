import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { findAvailablePort } from "../scripts/yandex-dev-port.mjs";

async function listenOnEphemeralPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ port: 0 }, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Expected TCP address");
  }
  return { server, port: address.port };
}

test("findAvailablePort skips a port already occupied by another dev proxy", async () => {
  const { server, port } = await listenOnEphemeralPort();
  try {
    const selected = await findAvailablePort(port);
    assert.notEqual(selected, port);
    assert.ok(selected > port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("findAvailablePort keeps the preferred port when it is free", async () => {
  const { server, port } = await listenOnEphemeralPort();
  await new Promise((resolve) => server.close(resolve));

  const selected = await findAvailablePort(port);
  assert.equal(selected, port);
});
