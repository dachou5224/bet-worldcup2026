import test from "node:test";
import assert from "node:assert/strict";
import {
  capStake,
  fractionalKelly,
  fullKelly,
} from "../quant/portfolio/kelly.js";

test("fullKelly returns zero for negative EV bets", () => {
  assert.equal(fullKelly(2, 0.45), 0);
});

test("fractionalKelly scales the full Kelly stake", () => {
  const full = fullKelly(2.5, 0.5);
  assert.equal(fractionalKelly(2.5, 0.5, 0.25), full * 0.25);
});

test("capStake applies the smallest configured cap", () => {
  assert.equal(capStake(0.08, { singleBetCap: 0.05, matchCap: 0.07, dayCap: 0.1 }), 0.05);
});

test("capStake floors negative stake to zero", () => {
  assert.equal(capStake(-0.1, { singleBetCap: 0.05, matchCap: 0.05, dayCap: 0.05 }), 0);
});
