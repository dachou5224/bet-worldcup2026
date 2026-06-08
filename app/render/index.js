import { state, setActiveTab, setLiveFilter, setSignalFilter, setMarketTab, setDrawerRowKey } from "../state.js";
import { filterLiveMatches, filterPredictions, buildMatchdayBuckets } from "../filters.js";
import { buildUnifiedMatches, buildNormalizedLookup } from "../fixture-match.js";
import {
  renderKpiHero,
  renderFallbackBanner,
  renderStatusBar,
  renderFilterBar,
  renderMatchdayStrip,
  renderTopEdgeStrip,
} from "./kpi-hero.js";
import {
  renderSignalList,
  renderMatchDayGroups,
  renderLiveToolbar,
  renderProviderPanel,
  renderReviewSections,
  renderHowComputed,
} from "./views.js";
import { pickWeeklySpotlightMatches, buildSpotlightDayBuckets, buildFullScheduleGroups } from "../schedule.js";
import {
  renderScheduleSpotlight,
  renderScheduleDayRail,
  renderScheduleWeekRail,
  renderScheduleFullDropdown,
} from "./schedule-spotlight.js";
import { renderDataQualityPanel, renderMatchDrawer, setLoading } from "./drawer.js";

function buildRowIndex(unifiedMatches, normalizedLookup, analysisItems) {
  const index = new Map();
  for (const match of unifiedMatches) {
    const rowKey = `${match.kind}-${match.id}`;
    const normalized =
      normalizedLookup.get(match.fixture) ||
      (match.prediction ? normalizedLookup.get(match.prediction.fixture) : null);
    index.set(rowKey, {
      match,
      prediction: match.prediction || null,
      normalized,
      analysisItems,
    });
  }
  for (const prediction of state.dashboard?.tomorrowPredictions || []) {
    const rowKey = `prediction-${prediction.id}`;
    if (!index.has(rowKey)) {
      index.set(rowKey, {
        match: {
          fixture: prediction.fixture,
          home: prediction.fixture.split(/\s+vs\s+/i)[0],
          away: prediction.fixture.split(/\s+vs\s+/i)[1] || "",
          kickoff: prediction.kickoff,
          stage: "预测信号",
          status: "待开赛",
        },
        prediction,
        normalized: normalizedLookup.get(prediction.fixture) || null,
        analysisItems,
      });
    }
  }
  return index;
}

function setActiveTabUi(tab) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("primary-tab-active", button.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== `view-${tab}`);
  });
}

export function renderDashboard(bundle) {
  const data = bundle.dashboard;
  state.dashboard = data;
  state.normalizedMatches = bundle.normalizedMatches || [];
  state.qualityReport = bundle.qualityReport;
  state.providerCoverage = bundle.providerCoverage;
  state.dataAudit = bundle.dataAudit || null;

  renderKpiHero(data, bundle);
  renderFallbackBanner(data, bundle.dataAudit ?? state.dataAudit);
  renderStatusBar(data);
  renderFilterBar(state.signalFilters);

  const allPredictions = data.tomorrowPredictions || [];
  const filteredPredictions = filterPredictions(allPredictions, state.signalFilters);
  const matchdayBuckets = buildMatchdayBuckets(allPredictions);

  renderMatchdayStrip(matchdayBuckets, state.signalFilters.matchday);
  renderTopEdgeStrip(filteredPredictions);
  renderSignalList(filteredPredictions);
  renderHowComputed();

  const calendar = data.scheduleCalendar || { openingDate: "2026-06-11", endDate: "2026-07-19" };
  const allUnifiedMatches = buildUnifiedMatches(data.liveMatches || [], allPredictions);
  const spotlight = pickWeeklySpotlightMatches(allUnifiedMatches, {
    openingDate: calendar.openingDate,
    endDate: calendar.endDate,
    weekIndex: state.spotlightWeekIndex,
  });

  renderScheduleWeekRail(spotlight.weeks, spotlight.meta.weekIndex, spotlight.meta.defaultWeekIndex);
  renderScheduleFullDropdown(buildFullScheduleGroups(allUnifiedMatches));
  renderScheduleSpotlight(spotlight);
  renderScheduleDayRail(buildSpotlightDayBuckets(spotlight.matches));

  const liveMatches = filterLiveMatches(data.liveMatches || [], state.liveFilter);
  const unifiedMatches = buildUnifiedMatches(data.liveMatches || [], allPredictions);
  const normalizedLookup = buildNormalizedLookup(state.normalizedMatches);
  state.rowIndex = buildRowIndex(unifiedMatches, normalizedLookup, data.analysisItems || []);

  renderLiveToolbar(state.liveFilter);
  const filteredLiveMatches = filterLiveMatches(data.liveMatches || [], state.liveFilter);
  const filteredUnifiedMatches = buildUnifiedMatches(filteredLiveMatches, allPredictions);
  renderMatchDayGroups(filteredUnifiedMatches, normalizedLookup, state.marketTabByRow);

  renderProviderPanel(data);
  renderDataQualityPanel(bundle.qualityReport, bundle.providerCoverage);
  renderReviewSections(data);

  if (state.drawerRowKey) {
    renderMatchDrawer(state.rowIndex.get(state.drawerRowKey) || null);
  }

  setActiveTabUi(state.activeTab);
}

export function renderError() {
  if (!state.dashboard) {
    renderStatusBar({ lastUpdated: new Date().toISOString(), providerHealth: {} }, true);
    return;
  }
  renderStatusBar(state.dashboard, true);
}

export { setActiveTabUi, setLoading };
