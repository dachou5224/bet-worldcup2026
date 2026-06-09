import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { getStaticPageData } from "../data-sources.js";

test("research mode can replay live snapshot when explicitly enabled", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "guess-worldcup-live-replay-"));
  const liveSnapshotFile = path.join(tempDir, "live-data.json");
  const previousEnv = {
    APP_MODE: process.env.APP_MODE,
    LIVE_DATA_MODE: process.env.LIVE_DATA_MODE,
    FOOTBALL_DATA_API_KEY: process.env.FOOTBALL_DATA_API_KEY,
    LIVE_SNAPSHOT_REPLAY_ENABLED: process.env.LIVE_SNAPSHOT_REPLAY_ENABLED,
    LIVE_SNAPSHOT_REPLAY_FILE: process.env.LIVE_SNAPSHOT_REPLAY_FILE,
  };

  writeFileSync(
    liveSnapshotFile,
    JSON.stringify(
      {
        capturedAt: "2026-06-09T00:00:00.000Z",
        source: "football-data.org",
        sourceMode: "real",
        liveData: {
          liveMatches: [
            {
              id: "match-1",
              home: "墨西哥",
              away: "日本",
              kickoff: "2026-06-11T12:00:00Z",
            },
          ],
        },
      },
      null,
      2,
    ),
  );

  try {
    process.env.APP_MODE = "research";
    process.env.LIVE_DATA_MODE = "real";
    process.env.FOOTBALL_DATA_API_KEY = "";
    process.env.LIVE_SNAPSHOT_REPLAY_ENABLED = "true";
    process.env.LIVE_SNAPSHOT_REPLAY_FILE = liveSnapshotFile;

    const staticData = await getStaticPageData();

    assert.equal(staticData.liveMode, "real_snapshot_replay");
    assert.equal(staticData.liveMatches.length, 1);
    assert.equal(staticData.liveMatches[0].home, "墨西哥");
    assert.equal(staticData.liveSnapshotSource, "normalized_live_snapshot");
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("research mode auto-enables live snapshot replay when env is unset", async () => {
  const liveSnapshotFile = path.resolve("fixtures/snapshots/latest/live-data.json");
  const previousEnv = {
    APP_MODE: process.env.APP_MODE,
    LIVE_DATA_MODE: process.env.LIVE_DATA_MODE,
    FOOTBALL_DATA_API_KEY: process.env.FOOTBALL_DATA_API_KEY,
    LIVE_SNAPSHOT_REPLAY_ENABLED: process.env.LIVE_SNAPSHOT_REPLAY_ENABLED,
    LIVE_SNAPSHOT_REPLAY_FILE: process.env.LIVE_SNAPSHOT_REPLAY_FILE,
  };

  try {
    process.env.APP_MODE = "research";
    process.env.LIVE_DATA_MODE = "real";
    process.env.FOOTBALL_DATA_API_KEY = "";
    delete process.env.LIVE_SNAPSHOT_REPLAY_ENABLED;
    process.env.LIVE_SNAPSHOT_REPLAY_FILE = liveSnapshotFile;

    const staticData = await getStaticPageData();

    assert.equal(staticData.liveMode, "real_snapshot_replay");
    assert.ok(staticData.liveMatches.length > 0);
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
