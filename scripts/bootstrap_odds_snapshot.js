import { loadLocalEnv } from "../lib/load-env.js";
import {
  writeOddsSnapshotFromBzzoiro,
  writeOddsSnapshotFromLiveBzzoiro,
} from "../lib/bootstrap-odds-from-bzzoiro.js";
import { getProviderConfig } from "../provider-config.js";

loadLocalEnv();

const outputFile =
  process.env.ODDS_SNAPSHOT_REPLAY_FILE ||
  "fixtures/snapshots/latest/raw/the-odds-api-h2h.json";

const preferLive =
  process.argv.includes("--live") ||
  (process.env.ODDS_BOOTSTRAP_LIVE || "true") !== "false";

async function run() {
  const config = getProviderConfig();
  const reason = process.env.ODDS_BOOTSTRAP_REASON || "manual bootstrap from bzzoiro";

  if (preferLive && config.bzzoiroApiToken) {
    try {
      const result = await writeOddsSnapshotFromLiveBzzoiro(outputFile, config, {
        reason: `${reason} (live)`,
      });
      console.log(
        JSON.stringify(
          {
            ok: true,
            mode: "live",
            ...result,
          },
          null,
          2,
        ),
      );
      return;
    } catch (error) {
      if (process.env.ODDS_BOOTSTRAP_LIVE_ONLY === "true") {
        throw error;
      }
      console.error(`live bootstrap failed, falling back to cache: ${error.message}`);
    }
  }

  const result = writeOddsSnapshotFromBzzoiro(outputFile, {
    reason,
    cacheDir: config.providerCacheDir,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "cache",
        ...result,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
