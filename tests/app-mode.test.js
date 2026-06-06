import test from "node:test";
import assert from "node:assert/strict";
import { allowsProviderFallback, normalizeAppMode } from "../lib/app-mode.js";

test("normalizeAppMode defaults unknown values to demo", () => {
  assert.equal(normalizeAppMode(undefined), "demo");
  assert.equal(normalizeAppMode("anything"), "demo");
});

test("normalizeAppMode preserves research mode", () => {
  assert.equal(normalizeAppMode("research"), "research");
});

test("allowsProviderFallback only in demo mode", () => {
  assert.equal(allowsProviderFallback("demo"), true);
  assert.equal(allowsProviderFallback("research"), false);
});
