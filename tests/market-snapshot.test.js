import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketSnapshotBundle,
  isLayerASafeMarketSnapshot,
  normalizeRawMarketBoard,
  summarizeMarketSnapshots,
} from "../quant/normalization/market-snapshot.js";
import { buildDataQualityReport } from "../data-hub.js";
import { validateMarketSnapshots } from "../schemas/market-snapshot.js";

const rawMarketBoard = [
  {
    id: 101,
    home: "墨西哥",
    away: "日本",
    kickoff: "2026-06-11 20:00 CST",
    updatedAtLabel: "2 min ago",
    oddsProviders: [
      {
        provider: "Bet365",
        updatedAt: "2026-06-05T14:28:00+08:00",
        odds: { home: 2.04, draw: 3.45, away: 3.75 },
        markets: [
          {
            key: "spreads",
            lastUpdate: "2026-06-05T14:28:00+08:00",
            outcomes: [
              { name: "墨西哥", price: 1.91, point: -0.5 },
              { name: "日本", price: 1.95, point: 0.5 },
            ],
          },
          {
            key: "totals",
            lastUpdate: "2026-06-05T14:27:00+08:00",
            outcomes: [
              { name: "Over", price: 1.88, point: 2.5 },
              { name: "Under", price: 1.92, point: 2.5 },
            ],
          },
        ],
      },
    ],
    predictionMarkets: [
      {
        provider: "Polymarket",
        updatedAt: "2026-06-05T14:27:00+08:00",
        probabilities: { home: 0.44, draw: 0.27, away: 0.29 },
        liquidity: 1234,
        volume: 5678,
      },
    ],
  },
];

test("normalizeRawMarketBoard produces unified market snapshots", () => {
  const snapshots = normalizeRawMarketBoard(rawMarketBoard);

  assert.equal(snapshots.length, 4);
  assert.equal(snapshots.filter((snapshot) => snapshot.marketType === "h2h").length, 2);
  assert.equal(snapshots.filter((snapshot) => snapshot.marketType === "spread").length, 1);
  assert.equal(snapshots.filter((snapshot) => snapshot.marketType === "total").length, 1);

  const predictionSnapshot = snapshots.find(
    (snapshot) => snapshot.sourceMeta.marketNature === "prediction_market",
  );
  assert.ok(predictionSnapshot);
  assert.equal(predictionSnapshot.bookmaker, null);
  assert.equal(predictionSnapshot.sourceMeta.directEVEligible, false);
  assert.equal(predictionSnapshot.outcomes[0].probability, 0.44);

  const bookmakerSnapshot = snapshots.find(
    (snapshot) => snapshot.marketType === "spread" && snapshot.sourceMeta.marketNature === "bookmaker",
  );
  assert.ok(bookmakerSnapshot);
  assert.equal(bookmakerSnapshot.sourceMeta.directEVEligible, true);
  assert.equal(bookmakerSnapshot.line, -0.5);
});

test("validateMarketSnapshots accepts normalized fixture output", () => {
  const snapshots = normalizeRawMarketBoard(rawMarketBoard);
  const validation = validateMarketSnapshots(snapshots);

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.errors, []);
});

test("buildMarketSnapshotBundle summarizes fixture coverage", () => {
  const bundle = buildMarketSnapshotBundle(rawMarketBoard);

  assert.equal(bundle.summary.fixtureCount, 1);
  assert.equal(bundle.summary.snapshotCount, 4);
  assert.equal(bundle.summary.marketTypeCounts.h2h, 2);
  assert.equal(bundle.summary.marketTypeCounts.spread, 1);
  assert.equal(bundle.summary.marketTypeCounts.total, 1);
  assert.equal(bundle.summary.directEVEligibleCount, 3);
  assert.equal(bundle.summary.predictionMarketCount, 1);
  assert.equal(bundle.marketSnapshots.length, 4);
  assert.ok(bundle.marketSnapshots.every((snapshot) => snapshot.snapshotId));
});

test("isLayerASafeMarketSnapshot excludes prediction market snapshots", () => {
  const snapshots = normalizeRawMarketBoard(rawMarketBoard);
  const safeCount = snapshots.filter(isLayerASafeMarketSnapshot).length;

  assert.equal(safeCount, 3);
  assert.equal(summarizeMarketSnapshots(snapshots).directEVEligibleCount, 3);
});

test("buildDataQualityReport includes market snapshot checks", async () => {
  const report = await buildDataQualityReport();

  assert.equal(report.marketSnapshotSchemaOk, true);
  assert.ok(Array.isArray(report.marketSnapshotSchemaErrors));
  assert.ok(report.marketSnapshotSummary.snapshotCount > 0);
  assert.ok(report.layerCoverage.layerA >= 0);
  assert.ok(report.layerCoverage.layerB >= 0);
  assert.ok(report.layerCoverage.layerC >= 0);
  assert.ok(Number.isInteger(report.layerAReadyCount));
  assert.ok(report.portfolioReview);
  assert.ok(report.backtestReview);
  assert.ok(typeof report.appMode === "string");
  assert.ok(report.sourceMode && typeof report.sourceMode === "object");
  assert.equal(typeof report.sourceMode.market, "string");
  assert.equal(typeof report.sourceMode.live, "string");
  assert.equal(typeof report.sourceMode.jingcai, "string");
  assert.ok(report.fallbackUsed && typeof report.fallbackUsed === "object");
  assert.equal(typeof report.fallbackUsed.any, "boolean");
  assert.equal(typeof report.fallbackUsed.jingcai, "boolean");
  assert.equal(typeof report.researchSafe, "boolean");
  assert.ok(report.matches.every((match) => typeof match.marketSnapshotCount === "number"));
  assert.ok(report.matches.every((match) => typeof match.bookmakerDiversity === "number"));
  assert.ok(report.matches.every((match) => match.layerAReadiness && typeof match.layerAReadiness === "object"));
  assert.ok(
    report.matches.every(
      (match) =>
        typeof match.layerAReadiness.canEnterLayerA === "boolean" &&
        Array.isArray(match.layerAReadiness.blockReasons) &&
        typeof match.layerAReadiness.hasPredictionMarket === "boolean",
    ),
  );
  assert.ok(report.matches.every((match) => match.qualitySignals && typeof match.qualitySignals === "object"));
  assert.ok(
    report.matches.every(
      (match) =>
        typeof match.qualitySignals.hasTimestampedSnapshots === "boolean" &&
        typeof match.qualitySignals.hasClosingOrPreCloseSnapshot === "boolean" &&
        typeof match.qualitySignals.hasSettlementResult === "boolean" &&
        typeof match.qualitySignals.staleOdds === "boolean" &&
        typeof match.qualitySignals.providerConflictLevel === "string" &&
        typeof match.qualitySignals.officialScheduleAvailable === "boolean",
    ),
  );
});
