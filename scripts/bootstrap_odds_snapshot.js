import { loadLocalEnv } from "../lib/load-env.js";
import { writeOddsSnapshotFromBzzoiro } from "../lib/bootstrap-odds-from-bzzoiro.js";

loadLocalEnv();

const outputFile =
  process.env.ODDS_SNAPSHOT_REPLAY_FILE ||
  "fixtures/snapshots/latest/raw/the-odds-api-h2h.json";

try {
  const result = writeOddsSnapshotFromBzzoiro(outputFile, {
    reason: process.env.ODDS_BOOTSTRAP_REASON || "manual bootstrap from bzzoiro cache",
    cacheDir: process.env.PROVIDER_CACHE_DIR || "./fixtures/cache",
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
