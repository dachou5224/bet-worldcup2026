import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPipelineData } from "../dashboard-data.js";
import { getProviderStatus, getSupplementalSignals, getStaticPageData } from "../data-sources.js";
import { projectRoot } from "../lib/paths.js";

function writeSnapshot(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function run() {
  const outputDir = path.join(projectRoot, "fixtures", "snapshots");
  const capturedAt = new Date().toISOString();

  const [providerStatus, pipelineData, liveData, supplementalSignals] = await Promise.all([
    getProviderStatus(),
    getPipelineData(),
    getStaticPageData(),
    getSupplementalSignals(),
  ]);

  writeSnapshot(path.join(outputDir, "provider-status.json"), {
    capturedAt,
    providerStatus,
  });
  writeSnapshot(path.join(outputDir, "prediction-pipeline.json"), {
    capturedAt,
    pipelineData,
  });
  writeSnapshot(path.join(outputDir, "live-data.json"), {
    capturedAt,
    liveData,
  });
  writeSnapshot(path.join(outputDir, "supplemental-signals.json"), {
    capturedAt,
    supplementalSignals,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir,
        files: [
          "provider-status.json",
          "prediction-pipeline.json",
          "live-data.json",
          "supplemental-signals.json",
        ],
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
