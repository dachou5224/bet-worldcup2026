import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGroupStageEnvelope,
  EXHIBIT5_GROUP_MATCHES_RAW,
  groupStageMatchesToCsv,
} from "../lib/goldman-sachs-group-stage-extract.js";
import {
  buildPredictionsEnvelope,
  parseExhibit7AdvancementTable,
  predictionsToCsv,
} from "../lib/goldman-sachs-pdf-extract.js";

const SAMPLE_BLOCK = `
Exhibit 7: Probabilities of Advancement in the 2026 World Cup
Team R32 R16 QF SF Final Winner Team R32 R16 QF SF Final Winner
Spain 99.1 80.6 65.1 55.3 37.5 25.7 Uzbekistan 54.5 18.9 6.2 2.0 0.6 0.2
France 96.2 82.4 61.9 47.0 28.9 18.9 Australia 59.4 28.1 9.9 2.6 0.8 0.2
Model-Implied Probabilities of Advancing in the 2026 World Cup (as of  29 May 2026)
`;

test("parseExhibit7AdvancementTable parses paired team rows", () => {
  const rows = parseExhibit7AdvancementTable(SAMPLE_BLOCK);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].team, "Spain");
  assert.equal(rows[0].probabilities.winner, 0.257);
  assert.equal(rows[1].team, "Uzbekistan");
  assert.equal(rows[1].probabilities.round_of_32, 0.545);
});

test("buildPredictionsEnvelope produces csv aligned with prior schema", () => {
  const teams = parseExhibit7AdvancementTable(SAMPLE_BLOCK);
  const envelope = buildPredictionsEnvelope(teams);
  const csv = predictionsToCsv(envelope);
  assert.match(csv, /^source,report_title,report_date,team,market_type,stage,probability/);
  assert.match(csv, /Spain,outright,winner,0\.257/);
  assert.match(csv, /France,tournament_advancement,semi_final,0\.47/);
});

test("buildGroupStageEnvelope covers 12 groups and 72 modal matches", () => {
  assert.equal(EXHIBIT5_GROUP_MATCHES_RAW.length, 72);
  const envelope = buildGroupStageEnvelope();
  assert.equal(envelope.validation.matchCount, 72);
  assert.equal(envelope.validation.groupCount, 12);
  assert.equal(envelope.validation.standingRowCount, 48);
  const csv = groupStageMatchesToCsv(envelope);
  assert.match(csv, /Exhibit 5/);
  assert.match(csv, /Spain,Cape Verde,3,0/);
  assert.match(csv, /USA,Paraguay,1,1/);
});
