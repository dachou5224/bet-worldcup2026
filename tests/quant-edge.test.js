import test from "node:test";
import assert from "node:assert/strict";
import {
  edge,
  expectedValue,
  relativeEdge,
  shrinkProbability,
} from "../quant/edge/ev.js";

test("expectedValue is positive when model probability beats market price", () => {
  assert.ok(expectedValue(2.5, 0.45) > 0);
});

test("edge and relativeEdge compute absolute and relative advantage", () => {
  assert.ok(Math.abs(edge(0.44, 0.4) - 0.04) < 1e-12);
  assert.ok(Math.abs(relativeEdge(0.44, 0.4) - 0.1) < 1e-12);
});

test("shrinkProbability blends model and market probabilities", () => {
  assert.equal(shrinkProbability(0.5, 0.4, 0.25), 0.42500000000000004);
});

test("expectedValue rejects zero or invalid odds", () => {
  assert.throws(() => expectedValue(1, 0.5), /greater than 1/);
});
