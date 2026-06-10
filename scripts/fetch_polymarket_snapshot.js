import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  describeProxyUsage,
  fetchJsonViaHttpsProxy,
  resolveHttpsProxyUrl,
} from "../lib/https-proxy-fetch.js";
import { isFifwcMatchEvent } from "../lib/polymarket-fifwc-normalize.js";
import {
  resolveSnapshotDirs,
  wrapSnapshotPayload,
  writeJsonSnapshot,
} from "../lib/snapshot-store.js";
import { withAbPolymarketRawEnvelope } from "../lib/snapshot-ab-contract.js";

const DEFAULT_SSH_HOST = process.env.POLYMARKET_VPS_SSH_HOST || "nice-ai-LZ";
const FIFWC_SERIES_ID = process.env.POLYMARKET_FIFWC_SERIES_ID || "11433";

function filterFifwcMatchEvents(events) {
  return (events || []).filter(isFifwcMatchEvent);
}

function buildEventsUrl(limit) {
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(limit),
    series_id: FIFWC_SERIES_ID,
  });
  return `https://gamma-api.polymarket.com/events?${params.toString()}`;
}

export async function fetchEventsFromLocal(limit = 200, proxyUrl = null) {
  const url = buildEventsUrl(limit);
  const events = await fetchJsonViaHttpsProxy(url, {
    timeoutMs: 45000,
    proxyUrl: proxyUrl ?? resolveHttpsProxyUrl(),
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
      Referer: "https://polymarket.com/",
    },
  });

  if (!Array.isArray(events)) {
    throw new Error("Polymarket 响应不是数组");
  }

  return events;
}

export function fetchEventsFromVps(sshHost, limit = 200) {
  const url = buildEventsUrl(limit);
  const remoteScript = `
curl -sS --max-time 45 '${url}' \
  -H 'Accept: application/json' -H 'User-Agent: Mozilla/5.0' -H 'Referer: https://polymarket.com/'
`.trim();

  const stdout = execFileSync("ssh", ["-o", "ConnectTimeout=15", sshHost, remoteScript], {
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });

  const events = JSON.parse(stdout);
  if (!Array.isArray(events)) {
    throw new Error("VPS 返回的 Polymarket 响应不是数组");
  }

  return events;
}

export function buildPolymarketSnapshotFromEvents(events, meta = {}) {
  const capturedAt = meta.capturedAt || new Date().toISOString();
  const filtered = filterFifwcMatchEvents(events);

  return withAbPolymarketRawEnvelope(
    wrapSnapshotPayload(filtered, {
      capturedAt,
      source: "polymarket-gamma",
      sourceMode: "real",
      extra: {
        provider: "polymarket-gamma",
        sentimentOnly: false,
        directEVEligible: filtered.length > 0,
        semanticMappingConfidence: filtered.length > 0 ? "high" : "low",
        marketStructure: "split_binary_h2h",
        seriesId: FIFWC_SERIES_ID,
        eventCount: filtered.length,
        rawEventCount: events.length,
        fetchedVia: meta.fetchedVia || "vps_ssh",
        vpsHost: meta.vpsHost || null,
        fromCache: false,
      },
    }),
  );
}

function writePolymarketSnapshot(wrapped, capturedAt) {
  const dirs = resolveSnapshotDirs(capturedAt);
  const targets = [
    path.join(dirs.rawDir, "polymarket-worldcup.json"),
    path.join(dirs.versionedDir, "raw", "polymarket-worldcup.json"),
  ];

  for (const target of targets) {
    writeJsonSnapshot(target, wrapped);
  }

  return targets;
}

async function run() {
  const sshHost = DEFAULT_SSH_HOST;
  const capturedAt = new Date().toISOString();
  const limit = Number(process.env.POLYMARKET_LIMIT || 200);
  const proxyUrl = resolveHttpsProxyUrl();
  let events;
  let fetchedVia = "direct";
  let vpsHost = null;

  if (proxyUrl) {
    try {
      events = await fetchEventsFromLocal(limit, proxyUrl);
      fetchedVia = "https_proxy";
    } catch (error) {
      if (!sshHost) {
        throw error;
      }
      console.warn(`本地 HTTPS 代理抓取失败，回退 VPS：${error.message}`);
    }
  }

  if (!events) {
    events = fetchEventsFromVps(sshHost, limit);
    fetchedVia = "vps_ssh";
    vpsHost = sshHost;
  }

  const wrapped = buildPolymarketSnapshotFromEvents(events, {
    capturedAt,
    fetchedVia,
    vpsHost,
    proxy: describeProxyUsage(proxyUrl),
  });
  const targets = writePolymarketSnapshot(wrapped, capturedAt);

  console.log(
    JSON.stringify(
      {
        ok: true,
        capturedAt,
        fetchedVia,
        proxy: describeProxyUsage(proxyUrl),
        sshHost: vpsHost,
        seriesId: FIFWC_SERIES_ID,
        totalEvents: events.length,
        filteredEvents: wrapped.body.length,
        files: targets,
        sentimentOnly: false,
        directEVEligible: wrapped.body.length > 0,
      },
      null,
      2,
    ),
  );
}

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) || process.argv[1]?.endsWith("fetch_polymarket_snapshot.js")) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
