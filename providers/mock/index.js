import { mockAnalysisItems } from "../../fixtures/mock-analysis-items.js";
import { mockExpertOpinions } from "../../fixtures/mock-expert-opinions.js";
import { mockLiveMatches } from "../../fixtures/mock-live-matches.js";
import { mockMarketBoard } from "../../fixtures/mock-market-board.js";
import { mockModelingSteps } from "../../fixtures/mock-modeling-steps.js";
import { mockPostMatchReview } from "../../fixtures/mock-post-match-review.js";

export function getLiveMatches() {
  return mockLiveMatches;
}

export function getCompletedComparisons() {
  return mockPostMatchReview;
}

export function getAnalysisItems() {
  return mockAnalysisItems;
}

export function getModelingSteps() {
  return mockModelingSteps;
}

export function getRawMarketBoard() {
  return mockMarketBoard;
}

export function getExpertOpinions() {
  return mockExpertOpinions;
}
