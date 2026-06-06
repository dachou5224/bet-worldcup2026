function pickPrimarySpread(markets) {
  const spreads = (markets || []).filter((market) => market.key === "spreads");
  if (!spreads.length) {
    return null;
  }
  return spreads[0];
}

function pickPrimaryTotal(markets) {
  const totals = (markets || []).filter((market) => market.key === "totals");
  if (!totals.length) {
    return null;
  }
  return totals[0];
}

function formatOutcomePrice(outcome) {
  if (outcome?.price == null) {
    return "—";
  }
  const numeric = Number(outcome.price);
  if (!Number.isFinite(numeric)) {
    return String(outcome.price);
  }
  if (numeric > 0 && numeric <= 1) {
    return `${Math.round(numeric * 100)}%`;
  }
  return numeric.toFixed(2);
}

function formatPoint(outcome) {
  if (outcome?.point == null) {
    return "";
  }
  const point = Number(outcome.point);
  if (!Number.isFinite(point)) {
    return String(outcome.point);
  }
  return point > 0 ? `+${point}` : String(point);
}

export function extractMarketLines(normalizedMatch) {
  const providers = normalizedMatch?.rawSources?.oddsProviders || [];
  const markets = providers.flatMap((provider) => provider.markets || []);
  const spread = pickPrimarySpread(markets);
  const total = pickPrimaryTotal(markets);

  return {
    h2h: normalizedMatch?.consensus?.market || null,
    spread: spread
      ? {
          line: spread.outcomes?.[0]?.name || spread.outcomes?.[0]?.point,
          outcomes: (spread.outcomes || []).slice(0, 2).map((outcome) => ({
            label: `${formatPoint(outcome)} ${outcome.name || ""}`.trim(),
            price: formatOutcomePrice(outcome),
          })),
        }
      : null,
    total: total
      ? {
          line: total.outcomes?.[0]?.point ?? total.outcomes?.[0]?.name,
          outcomes: (total.outcomes || []).slice(0, 2).map((outcome) => ({
            label: outcome.name || "",
            price: formatOutcomePrice(outcome),
          })),
        }
      : null,
    spreadsCount: normalizedMatch?.providers?.spreadsCount || 0,
    totalsCount: normalizedMatch?.providers?.totalsCount || 0,
  };
}

export function renderMarketPills(marketTab, prediction, marketLines) {
  if (marketTab === "spread") {
    if (!marketLines.spread?.outcomes?.length) {
      return `<span class="match-footnote">暂无让球盘${marketLines.spreadsCount ? `（${marketLines.spreadsCount} 条源数据）` : ""}</span>`;
    }
    return `
      <div class="market-pills">
        ${marketLines.spread.outcomes
          .map(
            (outcome) =>
              `<span class="price-pill">${outcome.label} ${outcome.price}</span>`,
          )
          .join("")}
      </div>
    `;
  }

  if (marketTab === "total") {
    if (!marketLines.total?.outcomes?.length) {
      return `<span class="match-footnote">暂无大小球${marketLines.totalsCount ? `（${marketLines.totalsCount} 条源数据）` : ""}</span>`;
    }
    return `
      <div class="market-pills">
        ${marketLines.total.outcomes
          .map(
            (outcome) =>
              `<span class="price-pill">${outcome.label} ${outcome.price}</span>`,
          )
          .join("")}
      </div>
    `;
  }

  if (!prediction) {
    return `<span class="match-footnote">暂无胜负线数据</span>`;
  }

  return `
    <div class="market-pills">
      <span class="price-pill price-pill-yes">主 ${prediction.marketHome}%</span>
      <span class="price-pill">平 ${prediction.marketDraw}%</span>
      <span class="price-pill">客 ${prediction.marketAway}%</span>
    </div>
  `;
}
