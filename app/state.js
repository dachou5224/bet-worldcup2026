export const state = {
  dashboard: null,
  normalizedMatches: [],
  qualityReport: null,
  providerCoverage: null,
  rowIndex: new Map(),
  activeTab: "signals",
  liveFilter: "focus",
  signalFilters: {
    view: "recommended",
    when: "all",
    sort: "confidence",
    matchday: null,
  },
  marketTabByRow: {},
  drawerRowKey: null,
  isLoading: false,
  dataAudit: null,
  lastRefreshedAt: 0,
  lastScheduleRefreshAt: 0,
  lastSignalsRefreshAt: 0,
  lastMetadataRefreshAt: 0,
};

export function setActiveTab(tab) {
  state.activeTab = tab;
}

export function setLiveFilter(filter) {
  state.liveFilter = filter;
}

export function setSignalFilter(key, value) {
  state.signalFilters[key] = value;
}

export function setMarketTab(rowKey, tab) {
  state.marketTabByRow[rowKey] = tab;
}

export function setDrawerRowKey(rowKey) {
  state.drawerRowKey = rowKey;
}

export function closeDrawer() {
  state.drawerRowKey = null;
}
