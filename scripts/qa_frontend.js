const DEFAULT_PORT = process.env.PORT || "3000";
const BASE_URL = process.env.FRONTEND_QA_BASE_URL || `http://127.0.0.1:${DEFAULT_PORT}`;

async function fetchText(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}`);
  }
  return response.text();
}

async function fetchJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}`);
  }
  return response.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const health = await fetchJson("/api/health");
  assert(health.ok === true, "/api/health 未返回 ok");
  assert(health.service === "guess-worldcup-2026", `qa 指向了错误服务: ${health.service || "unknown"}`);

  const html = await fetchText("/");
  assert(html.includes('id="view-signals"'), "首页缺少价值信号视图");
  assert(html.includes('id="schedule-spotlight"'), "首页缺少未来三天赛程区块");
  assert(html.includes('src="./app.js"'), "首页未挂载 app.js");

  const modulePaths = [
    "/app/main.js",
    "/app/api.js",
    "/app/fixture-match.js",
    "/app/markets.js",
    "/app/render/index.js",
    "/app/schedule.js",
    "/app/render/schedule-spotlight.js",
  ];

  for (const path of modulePaths) {
    const source = await fetchText(path);
    assert(source.length > 20, `${path} 内容异常`);
  }

  const dashboard = await fetchJson("/api/dashboard");
  assert(Array.isArray(dashboard.liveMatches), "dashboard.liveMatches 不是数组");
  assert(Array.isArray(dashboard.tomorrowPredictions), "dashboard.tomorrowPredictions 不是数组");

  const normalized = await fetchJson("/api/data/normalized-matches");
  assert(Array.isArray(normalized), "normalized-matches 不是数组");

  console.log("frontend QA passed");
  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        liveMatches: dashboard.liveMatches.length,
        predictions: dashboard.tomorrowPredictions.length,
        normalized: normalized.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`frontend QA failed: ${error.message}. 可先启动本项目服务，再设置 FRONTEND_QA_BASE_URL 覆盖目标地址。`);
  process.exit(1);
});
