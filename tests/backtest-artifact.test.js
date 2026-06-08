import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getBacktestRun } from "../data-sources.js";
import { buildBacktestReview } from "../data-hub.js";
import {
  buildBacktestRunFromSettlements,
  readBacktestRunArtifactMeta,
  writeBacktestRunArtifact,
} from "../lib/backtest-artifacts.js";

test("backtest run prefers file artifact over mock fixture", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "guess-worldcup-backtest-"));
  const previousBacktestRunFile = process.env.BACKTEST_RUN_FILE;
  const artifactFile = "backtest-run.json";

  try {
    writeBacktestRunArtifact(
      [
        {
          fixtureId: 999,
          fixture: "测试队A vs 测试队B",
          kickoffLocal: "2026-06-11T20:00:00-05:00",
          marketType: "h2h",
          line: null,
          playType: "胜平负",
          selection: "胜",
          selectionCode: "3",
          finalScore: { home: 3, away: 1 },
          actualOutcome: "home",
          modelBeforeKickoff: { home: 0.58, draw: 0.2, away: 0.22 },
          marketClose: { home: 1.8, draw: 3.8, away: 4.1 },
          officialOddsAtRecommendation: 1.88,
          officialOddsAtStopSale: 1.8,
          stakeUnits: 2,
          observation: "临时文件型赛后样本。",
        },
      ],
      artifactFile,
      tempDir,
    );

    process.env.BACKTEST_RUN_FILE = path.join(tempDir, artifactFile);

    const review = await buildBacktestReview();

    assert.equal(review.recordCount, 1);
    assert.equal(review.records[0].fixtureId, 999);
    assert.equal(review.records[0].reviewText, "临时文件型赛后样本。");
    assert.equal(review.records[0].officialOddsAtRecommendation, 1.88);
  } finally {
    if (previousBacktestRunFile == null) {
      delete process.env.BACKTEST_RUN_FILE;
    } else {
      process.env.BACKTEST_RUN_FILE = previousBacktestRunFile;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("backtest run can be derived from live settlement entries", () => {
  const derived = buildBacktestRunFromSettlements(
    [
      {
        fixtureId: 1,
        fixture: "墨西哥 vs 日本",
        settlementStatus: "settled",
        settlementSourceMode: "live_official",
        officialSettlementComplete: true,
        reviewText: "真实赛果派生样本。",
        settlement: {
          playType: "胜平负",
          selection: "胜",
          selectionCode: "3",
          finalScore: { home: 2, away: 1 },
          actualOutcome: "home",
          marketClose: { home: 2.0, draw: 3.3, away: 3.8 },
          officialOddsAtRecommendation: 2.04,
          officialOddsAtStopSale: 2.0,
          stakeUnits: 1,
        },
      },
    ],
    [
      {
        fixtureId: 1,
        fixture: "墨西哥 vs 日本",
        kickoff: "2026-06-11T20:00:00-05:00",
        modelHome: 46,
        modelDraw: 28,
        modelAway: 26,
      },
    ],
    {
      capturedAt: "2026-06-08T00:00:00Z",
      sourceMode: "live_derived",
    },
  );

  assert.equal(derived.sourceMode, "live_derived");
  assert.equal(derived.backtestRun.length, 1);
  assert.equal(derived.backtestRun[0].fixtureId, 1);
  assert.equal(derived.backtestRun[0].modelBeforeKickoff.home, 0.46);
});

test("backtest run stays empty in research mode when no real artifact exists", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "guess-worldcup-backtest-research-"));
  const previousAppMode = process.env.APP_MODE;
  const previousBacktestRunFile = process.env.BACKTEST_RUN_FILE;

  try {
    process.env.APP_MODE = "research";
    process.env.BACKTEST_RUN_FILE = path.join(tempDir, "missing-backtest-run.json");

    const run = getBacktestRun();

    assert.deepEqual(run, []);
  } finally {
    if (previousAppMode == null) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = previousAppMode;
    }

    if (previousBacktestRunFile == null) {
      delete process.env.BACKTEST_RUN_FILE;
    } else {
      process.env.BACKTEST_RUN_FILE = previousBacktestRunFile;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("backtest artifact metadata is readable", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "guess-worldcup-backtest-meta-"));
  const previousBacktestRunFile = process.env.BACKTEST_RUN_FILE;
  const artifactFile = "backtest-run.json";

  try {
    writeBacktestRunArtifact(
      [
        {
          fixtureId: 1,
          fixture: "墨西哥 vs 日本",
        },
      ],
      artifactFile,
      tempDir,
      {
        sourceMode: "live_derived",
        summary: { recordCount: 1 },
      },
    );

    const meta = readBacktestRunArtifactMeta(path.join(tempDir, artifactFile), "");
    assert.equal(meta.sourceMode, "live_derived");
    assert.equal(meta.backtestRun.length, 1);
    assert.equal(meta.summary.recordCount, 1);
  } finally {
    if (previousBacktestRunFile == null) {
      delete process.env.BACKTEST_RUN_FILE;
    } else {
      process.env.BACKTEST_RUN_FILE = previousBacktestRunFile;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});
