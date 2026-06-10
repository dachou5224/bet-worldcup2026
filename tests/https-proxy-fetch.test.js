import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  describeProxyUsage,
  normalizeProxyUrl,
  resolveHttpsProxyUrl,
} from "../lib/https-proxy-fetch.js";

describe("https-proxy-fetch", () => {
  test("normalizeProxyUrl adds http scheme for host:port", () => {
    assert.equal(normalizeProxyUrl("127.0.0.1:3213"), "http://127.0.0.1:3213");
    assert.equal(normalizeProxyUrl("http://127.0.0.1:3213"), "http://127.0.0.1:3213");
    assert.equal(normalizeProxyUrl(""), null);
  });

  test("resolveHttpsProxyUrl prefers POLYMARKET_HTTPS_PROXY", () => {
    const previous = {
      polymarket: process.env.POLYMARKET_HTTPS_PROXY,
      https: process.env.HTTPS_PROXY,
    };

    process.env.POLYMARKET_HTTPS_PROXY = "127.0.0.1:7890";
    process.env.HTTPS_PROXY = "127.0.0.1:9999";

    try {
      assert.equal(resolveHttpsProxyUrl(), "http://127.0.0.1:7890");
    } finally {
      if (previous.polymarket == null) {
        delete process.env.POLYMARKET_HTTPS_PROXY;
      } else {
        process.env.POLYMARKET_HTTPS_PROXY = previous.polymarket;
      }

      if (previous.https == null) {
        delete process.env.HTTPS_PROXY;
      } else {
        process.env.HTTPS_PROXY = previous.https;
      }
    }
  });

  test("describeProxyUsage hides credentials", () => {
    const info = describeProxyUsage("http://127.0.0.1:3213");
    assert.equal(info.used, true);
    assert.equal(info.via, "https_proxy");
    assert.equal(info.host, "127.0.0.1");
    assert.equal(info.port, "3213");
  });
});
