import { proportionalDevig } from "../odds/devig.js";
import { buildScoreMatrix } from "./score-matrix.js";
import { priceH2H } from "../pricing/h2h.js";
import { priceSpread } from "../pricing/spread.js";
import { priceTotal } from "../pricing/total.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values) {
  const filtered = values.filter((value) => isFiniteNumber(value));
  if (!filtered.length) {
    return null;
  }

  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function extractFixtureTeams(fixture) {
  if (typeof fixture !== "string" || !fixture.includes(" vs ")) {
    return { homeTeam: null, awayTeam: null };
  }

  const [homeTeam, awayTeam] = fixture.split(" vs ").map((segment) => segment.trim());
  return {
    homeTeam: homeTeam || null,
    awayTeam: awayTeam || null,
  };
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function inferFairProbability(outcome) {
  if (!outcome) {
    return null;
  }

  if (isFiniteNumber(outcome.fairProbability)) {
    return outcome.fairProbability;
  }

  if (isFiniteNumber(outcome.probability)) {
    return outcome.probability;
  }

  if (isFiniteNumber(outcome.price)) {
    const fair = proportionalDevig([{ name: "x", decimalOdds: outcome.price }])[0];
    return fair?.fairProbability ?? null;
  }

  return null;
}

function inferSideName({ marketType, outcome, homeTeam, awayTeam, index, totalOutcomes }) {
  const name = normalizeName(outcome?.name);
  const point = isFiniteNumber(outcome?.point) ? outcome.point : null;

  if (marketType === "h2h") {
    if (name === "home" || (homeTeam && name === normalizeName(homeTeam))) {
      return "home";
    }
    if (name === "draw" || name === "tie") {
      return "draw";
    }
    if (name === "away" || (awayTeam && name === normalizeName(awayTeam))) {
      return "away";
    }
    if (index === 0) {
      return "home";
    }
    if (index === 1 && totalOutcomes >= 3) {
      return "draw";
    }
    return "away";
  }

  if (marketType === "total") {
    if (name.includes("over") || name.includes("大") || name.includes("上")) {
      return "over";
    }
    if (name.includes("under") || name.includes("小") || name.includes("下")) {
      return "under";
    }
    if (index === 0) {
      return "over";
    }
    return "under";
  }

  if (marketType === "spread") {
    if (name === "home" || (homeTeam && name === normalizeName(homeTeam)) || name.includes("主")) {
      return "home";
    }
    if (name === "away" || (awayTeam && name === normalizeName(awayTeam)) || name.includes("客")) {
      return "away";
    }
    if (point != null) {
      return point < 0 ? "home" : "away";
    }
    return index === 0 ? "home" : "away";
  }

  return name || `outcome_${index}`;
}

function buildCanonicalSideMap(snapshots, marketType, fixture) {
  const { homeTeam, awayTeam } = extractFixtureTeams(fixture);
  const sideBuckets = new Map();

  for (const snapshot of snapshots || []) {
    const outcomes = Array.isArray(snapshot.outcomes) ? snapshot.outcomes : [];
    const fairProbabilities = outcomes.map((outcome) => inferFairProbability(outcome));
    const priceOutcomes = outcomes
      .filter((outcome) => isFiniteNumber(outcome?.price))
      .map((outcome) => ({
        name: outcome.name,
        decimalOdds: outcome.price,
      }));
    const normalizedOutcomes =
      fairProbabilities.every((value) => isFiniteNumber(value)) && fairProbabilities.length === outcomes.length
        ? outcomes.map((outcome, index) => ({
            ...outcome,
            fairProbability: fairProbabilities[index],
          }))
        : priceOutcomes.length
          ? proportionalDevig(priceOutcomes)
          : [];

    normalizedOutcomes.forEach((outcome, index) => {
      const sideName = inferSideName({
        marketType,
        outcome,
        homeTeam,
        awayTeam,
        index,
        totalOutcomes: outcomes.length,
      });

      if (!sideBuckets.has(sideName)) {
        sideBuckets.set(sideName, []);
      }

      const probability = inferFairProbability({
        ...outcome,
        fairProbability: outcome.fairProbability,
      });
      if (isFiniteNumber(probability)) {
        sideBuckets.get(sideName).push(probability);
      }
    });
  }

  const canonicalMap = {};
  for (const [side, values] of sideBuckets.entries()) {
    const avg = average(values);
    if (avg != null) {
      canonicalMap[side] = avg;
    }
  }

  return canonicalMap;
}

function squareLogError(modelOdds, marketOdds) {
  if (!isFiniteNumber(modelOdds) || !isFiniteNumber(marketOdds) || modelOdds <= 0 || marketOdds <= 0) {
    return Infinity;
  }

  const diff = Math.log(modelOdds) - Math.log(marketOdds);
  return diff * diff;
}

function scoreCandidate(scoreMatrix, baseline, evidence) {
  let totalScore = 0;
  let coverage = 0;

  if (evidence.h2h && Object.keys(evidence.h2h).length) {
    const pricing = priceH2H(scoreMatrix);
    const marketHome = evidence.h2h.home;
    const marketDraw = evidence.h2h.draw;
    const marketAway = evidence.h2h.away;
    const modelBySide = Object.fromEntries(
      pricing.outcomes.map((outcome) => [outcome.name, outcome.fairOdds]),
    );

    totalScore += squareLogError(modelBySide.home, marketHome > 0 ? 1 / marketHome : null) * 2;
    totalScore += squareLogError(modelBySide.draw, marketDraw > 0 ? 1 / marketDraw : null) * 1.25;
    totalScore += squareLogError(modelBySide.away, marketAway > 0 ? 1 / marketAway : null) * 2;
    coverage += 3;
  }

  if (evidence.total && isFiniteNumber(evidence.total.line) && Object.keys(evidence.total.sides).length) {
    const pricing = priceTotal(scoreMatrix, evidence.total.line);
    const modelBySide = {
      over: pricing.over.fairOdds,
      under: pricing.under.fairOdds,
    };
    totalScore += squareLogError(modelBySide.over, evidence.total.sides.over > 0 ? 1 / evidence.total.sides.over : null) * 1.5;
    totalScore += squareLogError(modelBySide.under, evidence.total.sides.under > 0 ? 1 / evidence.total.sides.under : null) * 1.5;
    coverage += 2;
  }

  if (evidence.spread && isFiniteNumber(evidence.spread.line) && Object.keys(evidence.spread.sides).length) {
    const pricing = priceSpread(scoreMatrix, evidence.spread.line);
    const modelBySide = {
      home: pricing.home.fairOdds,
      away: pricing.away.fairOdds,
    };
    totalScore += squareLogError(modelBySide.home, evidence.spread.sides.home > 0 ? 1 / evidence.spread.sides.home : null) * 1.5;
    totalScore += squareLogError(modelBySide.away, evidence.spread.sides.away > 0 ? 1 / evidence.spread.sides.away : null) * 1.5;
    coverage += 2;
  }

  if (!coverage) {
    return {
      score: Infinity,
      coverage: 0,
    };
  }

  return {
    score: totalScore / coverage,
    coverage,
  };
}

function buildEvidenceFromSnapshots(contextSnapshots, baseline) {
  const bookmakerSnapshots = (contextSnapshots || []).filter(
    (snapshot) => snapshot.sourceMeta?.marketNature === "bookmaker",
  );

  const groupedByType = new Map();
  for (const snapshot of bookmakerSnapshots) {
    const current = groupedByType.get(snapshot.marketType) || [];
    current.push(snapshot);
    groupedByType.set(snapshot.marketType, current);
  }

  const h2hSnapshots = groupedByType.get("h2h") || [];
  const totalSnapshots = groupedByType.get("total") || [];
  const spreadSnapshots = groupedByType.get("spread") || [];

  const h2h = buildCanonicalSideMap(h2hSnapshots, "h2h", baseline.fixture);

  const bestSnapshotByLine = (snapshots) => {
    if (!snapshots.length) {
      return null;
    }

    const lineBuckets = new Map();
    for (const snapshot of snapshots) {
      const key = snapshot.line == null ? "*" : String(snapshot.line);
      const bucket = lineBuckets.get(key) || [];
      bucket.push(snapshot);
      lineBuckets.set(key, bucket);
    }

    const ranked = Array.from(lineBuckets.entries()).sort((a, b) => {
      if (b[1].length !== a[1].length) {
        return b[1].length - a[1].length;
      }

      const aLatest = a[1].reduce((max, snapshot) => Math.max(max, Date.parse(snapshot.capturedAt) || 0), 0);
      const bLatest = b[1].reduce((max, snapshot) => Math.max(max, Date.parse(snapshot.capturedAt) || 0), 0);
      return bLatest - aLatest;
    });

    const [lineToken, bucket] = ranked[0];
    const line = lineToken === "*" ? null : Number(lineToken);
    return {
      line,
      snapshots: bucket,
      sides: buildCanonicalSideMap(bucket, bucket[0].marketType, baseline.fixture),
    };
  };

  const total = bestSnapshotByLine(totalSnapshots);
  const spread = bestSnapshotByLine(spreadSnapshots);

  return {
    h2h,
    total,
    spread,
  };
}

function buildDummyScoreMatrix() {
  return buildScoreMatrix({ homeLambda: 1.35, awayLambda: 1.08, maxGoals: 10 });
}

function buildCalibratedMatrix(homeLambda, awayLambda) {
  return buildScoreMatrix({ homeLambda, awayLambda, maxGoals: 10 });
}

function searchLambdaRange(baseline, evidence, { coarseStep = 0.25, fineStep = 0.05 } = {}) {
  const coarseCandidates = [];
  for (let homeLambda = 0.25; homeLambda <= 5; homeLambda = round(homeLambda + coarseStep, 4)) {
    for (let awayLambda = 0.25; awayLambda <= 5; awayLambda = round(awayLambda + coarseStep, 4)) {
      const scoreMatrix = buildCalibratedMatrix(homeLambda, awayLambda);
      const result = scoreCandidate(scoreMatrix, baseline, evidence);
      if (Number.isFinite(result.score)) {
        coarseCandidates.push({
          homeLambda,
          awayLambda,
          score: result.score,
          coverage: result.coverage,
        });
      }
    }
  }

  if (!coarseCandidates.length) {
    return null;
  }

  coarseCandidates.sort((a, b) => a.score - b.score || b.coverage - a.coverage);
  const bestCoarse = coarseCandidates[0];

  const refinedCandidates = [];
  for (
    let homeLambda = clamp(bestCoarse.homeLambda - coarseStep, 0.1, 5);
    homeLambda <= clamp(bestCoarse.homeLambda + coarseStep, 0.1, 5);
    homeLambda = round(homeLambda + fineStep, 4)
  ) {
    for (
      let awayLambda = clamp(bestCoarse.awayLambda - coarseStep, 0.1, 5);
      awayLambda <= clamp(bestCoarse.awayLambda + coarseStep, 0.1, 5);
      awayLambda = round(awayLambda + fineStep, 4)
    ) {
      const scoreMatrix = buildCalibratedMatrix(homeLambda, awayLambda);
      const result = scoreCandidate(scoreMatrix, baseline, evidence);
      if (Number.isFinite(result.score)) {
        refinedCandidates.push({
          homeLambda,
          awayLambda,
          score: result.score,
          coverage: result.coverage,
        });
      }
    }
  }

  refinedCandidates.sort((a, b) => a.score - b.score || b.coverage - a.coverage);
  return refinedCandidates[0] || bestCoarse;
}

export function calibrateScoreModel(baseline, { contextSnapshots = [] } = {}) {
  const evidence = buildEvidenceFromSnapshots(contextSnapshots, baseline);
  const hasH2H = Object.keys(evidence.h2h || {}).length >= 3;
  const hasTotal = evidence.total && Object.keys(evidence.total.sides || {}).length >= 2;
  const hasSpread = evidence.spread && Object.keys(evidence.spread.sides || {}).length >= 2;

  if (!hasH2H) {
    const scoreMatrix = buildDummyScoreMatrix();
    return {
      mode: "fallback_dummy",
      confidence: "low",
      homeLambda: scoreMatrix.homeLambda,
      awayLambda: scoreMatrix.awayLambda,
      scoreMatrix,
      evidence,
      score: null,
      calibrated: false,
      fallbackReason: "missing_h2h_evidence",
    };
  }

  const best = searchLambdaRange(baseline, evidence);
  if (!best) {
    const scoreMatrix = buildDummyScoreMatrix();
    return {
      mode: "fallback_dummy",
      confidence: "low",
      homeLambda: scoreMatrix.homeLambda,
      awayLambda: scoreMatrix.awayLambda,
      scoreMatrix,
      evidence,
      score: null,
      calibrated: false,
      fallbackReason: "search_failed",
    };
  }

  const scoreMatrix = buildCalibratedMatrix(best.homeLambda, best.awayLambda);
  const coverageCount = Number(hasH2H) + Number(hasTotal) + Number(hasSpread);
  const mode = coverageCount >= 3 ? "market_calibrated" : "partial_market_calibrated";
  const confidence =
    best.score < 0.015 && coverageCount >= 3 ? "high" : best.score < 0.04 ? "medium" : "low";

  return {
    mode,
    confidence,
    homeLambda: scoreMatrix.homeLambda,
    awayLambda: scoreMatrix.awayLambda,
    scoreMatrix,
    evidence,
    score: best.score,
    calibrated: true,
    fallbackReason: null,
  };
}
