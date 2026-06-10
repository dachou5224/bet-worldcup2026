const OFF_PLAY = { onSale: false, odds: {} };

function normalizeTeamName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function buildMatchKey(homeTeam, awayTeam) {
  return `${normalizeTeamName(homeTeam)}__${normalizeTeamName(awayTeam)}`;
}

function toOdds310({ win, draw, lose }) {
  const odds = {};
  if (win != null) odds["3"] = Number(win);
  if (draw != null) odds["1"] = Number(draw);
  if (lose != null) odds["0"] = Number(lose);
  return odds;
}

function hasSpfOdds(spf) {
  return spf && (spf.win != null || spf.draw != null || spf.lose != null);
}

function hasRqspfOdds(rqspf) {
  return rqspf && hasSpfOdds(rqspf);
}

export function normalizeGeminiMatchToRecord(rawMatch, baselineMatch, capturedAt) {
  const spfOnSale = hasSpfOdds(rawMatch.spf);
  const rqspfOnSale = hasRqspfOdds(rawMatch.rqspf);

  return {
    jingcaiMatchId:
      rawMatch.jingcaiMatchCode ||
      rawMatch.jingcaiMatchId ||
      baselineMatch?.jingcaiMatchId ||
      `JC-GEMINI-${buildMatchKey(rawMatch.homeTeam, rawMatch.awayTeam)}`,
    fixtureId: baselineMatch?.fixtureId ?? rawMatch.fixtureId ?? null,
    competition: baselineMatch?.competition || "2026 FIFA World Cup",
    stage: baselineMatch?.stage || rawMatch.stage || "小组赛",
    homeTeam: rawMatch.homeTeam,
    awayTeam: rawMatch.awayTeam,
    kickoffLocal:
      rawMatch.kickoffLocal || baselineMatch?.kickoffLocal || null,
    saleStatus: spfOnSale ? "on_sale" : "not_on_sale",
    stopSaleTime: rawMatch.stopSaleTime || baselineMatch?.stopSaleTime || null,
    availablePlays: {
      spf: {
        onSale: spfOnSale,
        odds: spfOnSale ? toOdds310(rawMatch.spf) : {},
      },
      rqspf: {
        onSale: rqspfOnSale,
        handicap:
          rawMatch.rqspf?.handicap != null
            ? Number(rawMatch.rqspf.handicap)
            : baselineMatch?.availablePlays?.rqspf?.handicap ?? null,
        odds: rqspfOnSale ? toOdds310(rawMatch.rqspf) : {},
      },
      zjq: { ...OFF_PLAY },
      bf: { ...OFF_PLAY },
      bqc: { ...OFF_PLAY },
    },
    ruleVersion: baselineMatch?.ruleVersion || "2026-jczq-football",
    fetchedAt: capturedAt,
    geminiMeta: {
      sourceUrl: rawMatch.sourceUrl || null,
      jingcaiMatchCode: rawMatch.jingcaiMatchCode || null,
    },
  };
}

export function buildDraftFeedFromGeminiResponse(parsed, baselineEnvelope, meta = {}) {
  const capturedAt = meta.capturedAt || new Date().toISOString();
  const baselineMatches = baselineEnvelope?.matches || [];
  const baselineByKey = new Map(
    baselineMatches.map((match) => [buildMatchKey(match.homeTeam, match.awayTeam), match]),
  );

  const rawMatches = Array.isArray(parsed?.matches) ? parsed.matches : [];
  const matches = rawMatches.map((rawMatch) => {
    const key = buildMatchKey(rawMatch.homeTeam, rawMatch.awayTeam);
    return normalizeGeminiMatchToRecord(rawMatch, baselineByKey.get(key), capturedAt);
  });

  return {
    capturedAt,
    source: "gemini_search_draft",
    sourceUrl: "https://www.sporttery.cn/jc/zqszsc/",
    manualReviewed: false,
    directEVEligible: false,
    sourceMode: "draft",
    parserVersion: "2026.06.09-gemini-jingcai-draft",
    reviewRequiredReason:
      "Gemini + Google Search 草稿，赔率/停售时间须对照 sporttery.cn 人工确认后方可写入 latest 快照",
    gemini: {
      model: meta.model || null,
      proxy: meta.proxy || null,
      grounding: meta.grounding || null,
      sourceMode: meta.sourceMode || null,
      officialDomains: meta.officialDomains || null,
      rejectedSources: meta.rejectedSources || [],
      note: parsed?.note || null,
      found: parsed?.found ?? matches.length > 0,
    },
    alignmentNote:
      baselineEnvelope?.alignmentNote ||
      "fixtureId 优先从 fixtures/snapshots/latest/jingcai-official-feed.json 对齐",
    matches,
  };
}

function compareOddsMaps(left = {}, right = {}, label) {
  const changes = [];
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (left[key] !== right[key]) {
      changes.push(`${label}.${key}: ${right[key] ?? "—"} → ${left[key] ?? "—"}`);
    }
  }
  return changes;
}

export function diffDraftAgainstBaseline(draftEnvelope, baselineEnvelope) {
  const baselineMatches = baselineEnvelope?.matches || [];
  const draftMatches = draftEnvelope?.matches || [];
  const draftByKey = new Map(
    draftMatches.map((match) => [buildMatchKey(match.homeTeam, match.awayTeam), match]),
  );

  const diffs = [];

  for (const baseline of baselineMatches) {
    const key = buildMatchKey(baseline.homeTeam, baseline.awayTeam);
    const draft = draftByKey.get(key);

    if (!draft) {
      diffs.push({
        homeTeam: baseline.homeTeam,
        awayTeam: baseline.awayTeam,
        fixtureId: baseline.fixtureId,
        status: "missing_in_draft",
        changes: [],
      });
      continue;
    }

    const changes = [];
    if (baseline.stopSaleTime !== draft.stopSaleTime) {
      changes.push(`stopSaleTime: ${baseline.stopSaleTime} → ${draft.stopSaleTime}`);
    }

    changes.push(
      ...compareOddsMaps(
        draft.availablePlays?.spf?.odds,
        baseline.availablePlays?.spf?.odds,
        "spf",
      ),
    );
    changes.push(
      ...compareOddsMaps(
        draft.availablePlays?.rqspf?.odds,
        baseline.availablePlays?.rqspf?.odds,
        "rqspf",
      ),
    );

    if (baseline.availablePlays?.rqspf?.handicap !== draft.availablePlays?.rqspf?.handicap) {
      changes.push(
        `rqspf.handicap: ${baseline.availablePlays?.rqspf?.handicap} → ${draft.availablePlays?.rqspf?.handicap}`,
      );
    }

    diffs.push({
      homeTeam: baseline.homeTeam,
      awayTeam: baseline.awayTeam,
      fixtureId: baseline.fixtureId,
      status: changes.length ? "changed" : "unchanged",
      changes,
    });
  }

  const baselineKeys = new Set(
    baselineMatches.map((match) => buildMatchKey(match.homeTeam, match.awayTeam)),
  );
  for (const draft of draftMatches) {
    const key = buildMatchKey(draft.homeTeam, draft.awayTeam);
    if (!baselineKeys.has(key)) {
      diffs.push({
        homeTeam: draft.homeTeam,
        awayTeam: draft.awayTeam,
        fixtureId: draft.fixtureId,
        status: "new_in_draft",
        changes: ["baseline 中无对应场次"],
      });
    }
  }

  return {
    baselineCapturedAt: baselineEnvelope?.capturedAt || null,
    draftCapturedAt: draftEnvelope?.capturedAt || null,
    changedCount: diffs.filter((item) => item.status === "changed").length,
    missingCount: diffs.filter((item) => item.status === "missing_in_draft").length,
    newCount: diffs.filter((item) => item.status === "new_in_draft").length,
    unchangedCount: diffs.filter((item) => item.status === "unchanged").length,
    items: diffs,
  };
}

export function buildJingcaiGeminiPrompt(baselineEnvelope, options = {}) {
  const today = options.today || new Date();
  const dateLabel = today.toISOString().slice(0, 10);
  const officialOnly = options.officialOnly !== false;
  const officialUrls = options.officialUrls || ["https://www.sporttery.cn/jc/zqszsc/"];
  const officialDomains = options.officialDomains || ["sporttery.cn"];
  const domainHint = officialDomains.join(", ");
  const urlHint = officialUrls.join("\n");

  const matchLines = (baselineEnvelope?.matches || [])
    .map(
      (match, index) =>
        `${index + 1}. ${match.homeTeam} vs ${match.awayTeam} | fixtureId=${match.fixtureId} | kickoffLocal=${match.kickoffLocal}`,
    )
    .join("\n");

  const sourceRules = officialOnly
    ? `【硬性来源要求 — 必须遵守】
1. 只允许使用中国体育彩票官网 sporttery.cn 上的信息；禁止使用 500.com、okooo.com、zcai.cn、iqilu.com 等转载/第三方站点
2. Google 搜索必须带 site:sporttery.cn，例如：site:sporttery.cn 世界杯 竞彩 墨西哥 南非
3. 优先直接阅读以下官网 URL（使用 URL context）：
${urlHint}
4. 每条 match 的 sourceUrl 必须是 ${domainHint} 域名下的 https 链接；否则不要输出该场
5. 若官网当前未展示该场或未开售，不要猜测；该场省略并在 note 说明`
    : `数据来源优先 sporttery.cn；若官网不可达，可在 note 中说明并标注第三方 sourceUrl`;

  return `今天是 ${dateLabel}。请获取中国体育彩票「竞彩足球」2026 美加墨世界杯官方开售信息。

${sourceRules}

请尽量覆盖以下 baseline 场次（用于 fixtureId 对齐，不要改队名）：
${matchLines || "（无 baseline，请从官网搜索最近开售的世界杯竞彩场次）"}

输出要求：
1. 只输出 JSON，不要 markdown 说明
2. 胜平负 spf 与让球 rqspf 使用十进制赔率；win=主胜、draw=平、lose=客胜
3. stopSaleTime、kickoffLocal 用北京时间，ISO8601 或 "YYYY-MM-DD HH:mm" 均可
4. 查不到官网官方信息时不要编造

JSON 格式：
{
  "found": boolean,
  "matches": [
    {
      "homeTeam": "墨西哥",
      "awayTeam": "南非",
      "jingcaiMatchCode": "周四001",
      "kickoffLocal": "2026-06-12T03:00:00+08:00",
      "stopSaleTime": "2026-06-11T22:00:00+08:00",
      "spf": { "win": 1.31, "draw": 4.10, "lose": 8.30 },
      "rqspf": { "handicap": -1, "win": 2.13, "draw": 3.28, "lose": 2.82 },
      "sourceUrl": "https://www.sporttery.cn/..."
    }
  ],
  "note": "是否成功从官网获取、未能覆盖场次的原因"
}`;
}

export function normalizeOfficialDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

export function isOfficialJingcaiSourceUrl(sourceUrl, officialDomains = ["sporttery.cn"]) {
  if (!sourceUrl) {
    return false;
  }

  try {
    const hostname = normalizeOfficialDomain(new URL(sourceUrl).hostname);
    return officialDomains.some((domain) => {
      const normalized = normalizeOfficialDomain(domain);
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    });
  } catch {
    return false;
  }
}

export function filterOfficialGeminiMatches(parsed, officialDomains = ["sporttery.cn"]) {
  const rawMatches = Array.isArray(parsed?.matches) ? parsed.matches : [];
  const accepted = [];
  const rejected = [];

  for (const match of rawMatches) {
    if (isOfficialJingcaiSourceUrl(match.sourceUrl, officialDomains)) {
      accepted.push(match);
      continue;
    }

    rejected.push({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      sourceUrl: match.sourceUrl || null,
      reason: "sourceUrl 非 sporttery.cn 官网，已丢弃",
    });
  }

  return {
    found: accepted.length > 0,
    matches: accepted,
    rejected,
    note: parsed?.note || null,
  };
}
