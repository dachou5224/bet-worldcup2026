import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { getStaticPageData } from "../data-sources.js";

test("post-match review prefers file artifact over mock fixture", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "guess-worldcup-post-match-"));
  const artifactFile = path.join(tempDir, "post-match-review.json");
  const previousPostMatchReviewFile = process.env.POST_MATCH_REVIEW_FILE;
  const previousLiveDataMode = process.env.LIVE_DATA_MODE;

  writeFileSync(
    artifactFile,
    JSON.stringify(
      {
        capturedAt: "2026-06-08T00:00:00.000Z",
        completedComparisons: [
          {
            fixture: "测试 A vs 测试 B",
            predicted: "测试 A 胜",
            actual: "测试 A 胜",
            edge: "+1.5%",
            takeaway: "artifact-backed post-match review.",
            status: "hit",
          },
        ],
      },
      null,
      2,
    ),
  );

  try {
    process.env.POST_MATCH_REVIEW_FILE = path.join(tempDir, "post-match-review.json");
    process.env.LIVE_DATA_MODE = "mock";

    const staticData = await getStaticPageData();
    assert.equal(staticData.completedComparisons.length, 1);
    assert.equal(staticData.completedComparisons[0].fixture, "测试 A vs 测试 B");
    assert.equal(staticData.completedComparisons[0].status, "hit");
  } finally {
    if (previousPostMatchReviewFile === undefined) {
      delete process.env.POST_MATCH_REVIEW_FILE;
    } else {
      process.env.POST_MATCH_REVIEW_FILE = previousPostMatchReviewFile;
    }

    if (previousLiveDataMode === undefined) {
      delete process.env.LIVE_DATA_MODE;
    } else {
      process.env.LIVE_DATA_MODE = previousLiveDataMode;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});
