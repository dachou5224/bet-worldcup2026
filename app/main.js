import {
  fetchDashboardBundle,
  fetchLiveSchedule,
  fetchSignalSlice,
  fetchMetadataSlice,
  sanitizeBundle,
  mergeSignalFields,
} from "./api.js";
import { REFRESH_TIERS, isTierStale } from "./refresh-policy.js";
import {
  state,
  setActiveTab,
  setLiveFilter,
  setSignalFilter,
  setMarketTab,
  setDrawerRowKey,
  closeDrawer,
} from "./state.js";
import { renderDashboard, renderError, setActiveTabUi, setLoading } from "./render/index.js";
import { renderMatchDrawer } from "./render/drawer.js";

const refreshTimers = {
  schedule: null,
  signals: null,
  metadata: null,
};

function buildBundleFromState(overrides = {}) {
  return sanitizeBundle({
    dashboard: overrides.dashboard ?? state.dashboard,
    normalizedMatches: overrides.normalizedMatches ?? state.normalizedMatches,
    qualityReport: overrides.qualityReport ?? state.qualityReport,
    providerCoverage: overrides.providerCoverage ?? state.providerCoverage,
  });
}

function applyBundle(bundle) {
  state.dashboard = bundle.dashboard;
  state.normalizedMatches = bundle.normalizedMatches;
  state.qualityReport = bundle.qualityReport;
  state.providerCoverage = bundle.providerCoverage;
  state.dataAudit = bundle.dataAudit || null;
  renderDashboard(bundle);
  state.lastRefreshedAt = Date.now();
}

async function refreshScheduleTier({ background = true } = {}) {
  if (!state.dashboard) {
    return;
  }

  try {
    const liveMatches = await fetchLiveSchedule();
    const bundle = buildBundleFromState({
      dashboard: { ...state.dashboard, liveMatches },
    });
    applyBundle(bundle);
    state.lastScheduleRefreshAt = Date.now();
  } catch (error) {
    if (!background) {
      throw error;
    }
    console.error("[refresh:schedule]", error);
  }
}

async function refreshSignalsTier({ background = true } = {}) {
  if (!state.dashboard) {
    return;
  }

  try {
    const signalSlice = await fetchSignalSlice();
    const bundle = buildBundleFromState({
      dashboard: mergeSignalFields(state.dashboard, signalSlice),
      normalizedMatches: signalSlice.normalizedMatches,
    });
    applyBundle(bundle);
    state.lastSignalsRefreshAt = Date.now();
  } catch (error) {
    if (!background) {
      throw error;
    }
    console.error("[refresh:signals]", error);
  }
}

async function refreshMetadataTier({ background = true } = {}) {
  if (!state.dashboard) {
    return;
  }

  try {
    const metadata = await fetchMetadataSlice();
    const bundle = buildBundleFromState({
      dashboard: {
        ...state.dashboard,
        ...(metadata.completedComparisons != null
          ? { completedComparisons: metadata.completedComparisons }
          : {}),
        ...(metadata.portfolioReview != null ? { portfolioReview: metadata.portfolioReview } : {}),
        ...(metadata.backtestReview != null ? { backtestReview: metadata.backtestReview } : {}),
      },
      qualityReport: metadata.qualityReport,
      providerCoverage: metadata.providerCoverage,
    });
    applyBundle(bundle);
    state.lastMetadataRefreshAt = Date.now();
  } catch (error) {
    if (!background) {
      throw error;
    }
    console.error("[refresh:metadata]", error);
  }
}

async function refreshDashboard({ background = false } = {}) {
  if (!background) {
    state.isLoading = true;
    setLoading(true);
    document.querySelector("#refresh-btn")?.classList.add("is-loading");
  }

  try {
    const bundle = await fetchDashboardBundle();
    applyBundle(bundle);
    const now = Date.now();
    state.lastScheduleRefreshAt = now;
    state.lastSignalsRefreshAt = now;
    state.lastMetadataRefreshAt = now;
  } catch (error) {
    renderError();
    console.error(error);
  } finally {
    if (!background) {
      state.isLoading = false;
      setLoading(false);
      document.querySelector("#refresh-btn")?.classList.remove("is-loading");
    }
  }
}

function runTierIfVisible(tierKey, runner) {
  if (document.visibilityState !== "visible") {
    return;
  }
  runner({ background: true });
}

function scheduleAutoRefresh() {
  for (const tierKey of Object.keys(refreshTimers)) {
    clearInterval(refreshTimers[tierKey]);
  }

  refreshTimers.schedule = setInterval(
    () => runTierIfVisible("schedule", refreshScheduleTier),
    REFRESH_TIERS.schedule.intervalMs,
  );
  refreshTimers.signals = setInterval(
    () => runTierIfVisible("signals", refreshSignalsTier),
    REFRESH_TIERS.signals.intervalMs,
  );
  refreshTimers.metadata = setInterval(
    () => runTierIfVisible("metadata", refreshMetadataTier),
    REFRESH_TIERS.metadata.intervalMs,
  );
}

function refreshStaleTiers() {
  if (isTierStale(state.lastScheduleRefreshAt, "schedule")) {
    refreshScheduleTier({ background: true });
  }
  if (isTierStale(state.lastSignalsRefreshAt, "signals")) {
    refreshSignalsTier({ background: true });
  }
  if (isTierStale(state.lastMetadataRefreshAt, "metadata")) {
    refreshMetadataTier({ background: true });
  }
}

function bindVisibilityRefresh() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshStaleTiers();
    }
  });
}

function openDrawer(rowKey) {
  setDrawerRowKey(rowKey);
  renderMatchDrawer(state.rowIndex.get(rowKey) || null);
}

function isDrawerActivationKey(key) {
  return key === "Enter" || key === " ";
}

function bindEvents() {
  document.querySelector(".primary-tabs")?.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-tab]");
    if (!tabButton) {
      return;
    }
    setActiveTab(tabButton.dataset.tab);
    setActiveTabUi(state.activeTab);
  });

  document.querySelector("#refresh-btn")?.addEventListener("click", () => {
    refreshDashboard();
  });

  document.querySelector("#live-toolbar")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-live-filter]");
    if (!button || !state.dashboard) {
      return;
    }
    setLiveFilter(button.dataset.liveFilter);
    renderDashboard(buildBundleFromState());
  });

  document.querySelector("#filter-bar")?.addEventListener("change", (event) => {
    const select = event.target.closest("[data-filter]");
    if (!select || !state.dashboard) {
      return;
    }
    setSignalFilter(select.dataset.filter, select.value);
    renderDashboard(buildBundleFromState());
  });

  document.querySelector("#filter-bar")?.addEventListener("click", (event) => {
    if (event.target.id !== "filter-reset-btn" || !state.dashboard) {
      return;
    }
    state.signalFilters = { view: "recommended", when: "all", sort: "confidence", matchday: null };
    renderDashboard(buildBundleFromState());
  });

  document.querySelector("#matchday-strip")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-matchday]");
    if (!card || !state.dashboard) {
      return;
    }
    const value = card.dataset.matchday || null;
    setSignalFilter("matchday", value || null);
    renderDashboard(buildBundleFromState());
  });

  document.querySelector("#live-match-list")?.addEventListener("click", (event) => {
    const marketTab = event.target.closest("[data-market-tab]");
    if (marketTab) {
      event.stopPropagation();
      const rowKey = marketTab.closest("[data-row-key]")?.dataset.rowKey;
      if (!rowKey || !state.dashboard) {
        return;
      }
      setMarketTab(rowKey, marketTab.dataset.marketTab);
      renderDashboard(buildBundleFromState());
      return;
    }

    const drawerTrigger = event.target.closest("[data-open-drawer]");
    if (drawerTrigger) {
      openDrawer(drawerTrigger.dataset.openDrawer);
    }
  });

  document.querySelector("#signal-list")?.addEventListener("click", (event) => {
    const drawerTrigger = event.target.closest("[data-open-drawer]");
    if (drawerTrigger) {
      openDrawer(drawerTrigger.dataset.openDrawer);
    }
  });

  document.querySelector("#schedule-spotlight")?.addEventListener("click", (event) => {
    const drawerTrigger = event.target.closest("[data-open-drawer]");
    if (drawerTrigger) {
      openDrawer(drawerTrigger.dataset.openDrawer);
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target.id === "drawer-close" || event.target.id === "drawer-backdrop") {
      closeDrawer();
      renderMatchDrawer(null);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.drawerRowKey) {
      closeDrawer();
      renderMatchDrawer(null);
      return;
    }

    if (!isDrawerActivationKey(event.key)) {
      return;
    }

    const drawerTrigger = event.target.closest("[data-open-drawer]");
    if (!drawerTrigger) {
      return;
    }

    // 真实 <button> 由浏览器合成 click，交给现有 click 监听即可
    if (event.target instanceof HTMLButtonElement) {
      return;
    }

    event.preventDefault();
    openDrawer(drawerTrigger.dataset.openDrawer);
  });
}

export function initApp() {
  bindEvents();
  bindVisibilityRefresh();
  refreshDashboard();
  scheduleAutoRefresh();
}
