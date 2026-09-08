import test from "node:test";
import assert from "node:assert/strict";
import { CampaignProgressStore } from "../src/campaign-progress.js";
import { Language, SettingsStore } from "../src/settings.js";
import { YandexGamesAdapter } from "../src/platform/yandex-games.js";
import {
  PLAYER_DATA_STORAGE_FIELD,
  createPlayerDataStorage,
} from "../src/platform/player-data-storage.js";

function fallbackStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("Yandex-backed storage hydrates synchronously-used stores and persists their mutations", async () => {
  const setCalls = [];
  const player = {
    async getData() {
      return {
        [PLAYER_DATA_STORAGE_FIELD]: {
          version: 1,
          values: {
            "garden-js.campaign-progress.v3": JSON.stringify({
              version: 3,
              tutorialCompleted: true,
              solvedLevels: [0],
              cleanLevels: [0],
            }),
            "garden.settings.v1": JSON.stringify({ language: "en", soundEnabled: false }),
          },
        },
      };
    },
    async setData(data, flush) {
      setCalls.push({ data, flush });
    },
  };
  const adapter = new YandexGamesAdapter({
    globalObject: {
      YaGames: {
        init: async () => ({ getPlayer: async () => player }),
      },
    },
  });
  const storage = await createPlayerDataStorage({ adapter, fallback: null });

  const progress = new CampaignProgressStore({ storage });
  const settings = new SettingsStore({ storage });
  assert.equal(progress.isSolved(0), true);
  assert.equal(progress.isClean(0), true);
  assert.equal(settings.snapshot.language, Language.EN);
  assert.equal(settings.snapshot.soundEnabled, false);

  progress.complete(1, { clean: false });
  settings.setSoundEnabled(true);
  assert.equal(await storage.flush(), true);

  const last = setCalls.at(-1);
  assert.equal(last.flush, true);
  const saved = last.data[PLAYER_DATA_STORAGE_FIELD];
  assert.equal(saved.version, 1);
  assert.equal(JSON.parse(saved.values["garden-js.campaign-progress.v3"]).solvedLevels.includes(1), true);
  assert.equal(JSON.parse(saved.values["garden.settings.v1"]).soundEnabled, true);
});

test("Yandex-backed storage removes keys and keeps the rest of the namespace", async () => {
  const writes = [];
  const player = {
    async getData() {
      return {
        [PLAYER_DATA_STORAGE_FIELD]: {
          version: 1,
          values: { keep: "one", remove: "two" },
        },
      };
    },
    async setData(data) {
      writes.push(data);
    },
  };
  const adapter = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => ({ getPlayer: async () => player }) } },
  });
  const storage = await createPlayerDataStorage({ adapter, fallback: null });

  storage.removeItem("remove");
  await storage.flush();

  assert.equal(storage.getItem("keep"), "one");
  assert.equal(storage.getItem("remove"), null);
  assert.deepEqual(writes.at(-1)[PLAYER_DATA_STORAGE_FIELD].values, { keep: "one" });
});

test("when the SDK player is unavailable, standalone development uses the supplied fallback storage", async () => {
  const fallback = fallbackStorage();
  fallback.setItem("existing", "local");
  const adapter = new YandexGamesAdapter({
    globalObject: {},
    documentObject: undefined,
    sdkUrl: null,
  });

  const storage = await createPlayerDataStorage({ adapter, fallback });
  assert.equal(storage.getItem("existing"), "local");
  storage.setItem("new", "value");
  assert.equal(fallback.getItem("new"), "value");
  assert.equal(await storage.flush(), true);
});
