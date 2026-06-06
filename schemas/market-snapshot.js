function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value) {
  return typeof value === "string" && value.length > 0;
}

function isIdentifier(value) {
  return isNumber(value) || isString(value);
}

function isOptionalNumber(value) {
  return value == null || isNumber(value);
}

function isOptionalString(value) {
  return value == null || isString(value);
}

function validateOutcome(outcome, path) {
  const errors = [];

  if (!isObject(outcome)) {
    return [`${path} 必须是对象`];
  }

  if (!isString(outcome.name)) {
    errors.push(`${path}.name 缺失或不是字符串`);
  }

  if (!isOptionalNumber(outcome.price)) {
    errors.push(`${path}.price 不是数字或 null`);
  } else if (outcome.price != null && outcome.price <= 0) {
    errors.push(`${path}.price 必须大于 0`);
  }

  if (!isOptionalNumber(outcome.point)) {
    errors.push(`${path}.point 不是数字或 null`);
  }

  if (!isOptionalNumber(outcome.probability)) {
    errors.push(`${path}.probability 不是数字或 null`);
  } else if (outcome.probability != null && (outcome.probability < 0 || outcome.probability > 1)) {
    errors.push(`${path}.probability 必须在 0 到 1 之间`);
  }

  if (!isOptionalNumber(outcome.fairProbability)) {
    errors.push(`${path}.fairProbability 不是数字或 null`);
  } else if (
    outcome.fairProbability != null &&
    (outcome.fairProbability < 0 || outcome.fairProbability > 1)
  ) {
    errors.push(`${path}.fairProbability 必须在 0 到 1 之间`);
  }

  if (
    outcome.price == null &&
    outcome.probability == null &&
    outcome.fairProbability == null
  ) {
    errors.push(`${path} 至少需要 price / probability / fairProbability 之一`);
  }

  return errors;
}

function validateSourceMeta(sourceMeta, path) {
  const errors = [];

  if (!isObject(sourceMeta)) {
    return [`${path} 必须是对象`];
  }

  if (!isOptionalString(sourceMeta.region)) {
    errors.push(`${path}.region 不是字符串或 null`);
  }

  for (const field of ["rawEventId", "rawMarketId"]) {
    if (sourceMeta[field] != null && !isIdentifier(sourceMeta[field])) {
      errors.push(`${path}.${field} 不是字符串/数字或 null`);
    }
  }

  if (!isOptionalNumber(sourceMeta.liquidity)) {
    errors.push(`${path}.liquidity 不是数字或 null`);
  }

  if (!isOptionalNumber(sourceMeta.volume)) {
    errors.push(`${path}.volume 不是数字或 null`);
  }

  if (!isOptionalString(sourceMeta.marketNature)) {
    errors.push(`${path}.marketNature 不是字符串或 null`);
  }

  if (sourceMeta.directEVEligible != null && typeof sourceMeta.directEVEligible !== "boolean") {
    errors.push(`${path}.directEVEligible 不是布尔值或 null`);
  }

  return errors;
}

function validateMarketSnapshot(snapshot, index) {
  const path = `marketSnapshots[${index}]`;
  const errors = [];

  if (!isObject(snapshot)) {
    return [`${path} 必须是对象`];
  }

  if (!isString(snapshot.snapshotId)) {
    errors.push(`${path}.snapshotId 缺失或不是字符串`);
  }

  if (!isIdentifier(snapshot.fixtureId)) {
    errors.push(`${path}.fixtureId 缺失或不是字符串/数字`);
  }

  if (!isString(snapshot.provider)) {
    errors.push(`${path}.provider 缺失或不是字符串`);
  }

  if (!isOptionalString(snapshot.bookmaker)) {
    errors.push(`${path}.bookmaker 不是字符串或 null`);
  }

  if (!isString(snapshot.capturedAt)) {
    errors.push(`${path}.capturedAt 缺失或不是字符串`);
  }

  if (!isString(snapshot.marketType)) {
    errors.push(`${path}.marketType 缺失或不是字符串`);
  }

  if (!isOptionalNumber(snapshot.line) && !isOptionalString(snapshot.line)) {
    errors.push(`${path}.line 不是数字、字符串或 null`);
  }

  if (!isString(snapshot.period)) {
    errors.push(`${path}.period 缺失或不是字符串`);
  }

  if (!Array.isArray(snapshot.outcomes)) {
    errors.push(`${path}.outcomes 缺失或不是数组`);
  } else {
    snapshot.outcomes.forEach((outcome, outcomeIndex) => {
      errors.push(...validateOutcome(outcome, `${path}.outcomes[${outcomeIndex}]`));
    });
  }

  errors.push(...validateSourceMeta(snapshot.sourceMeta, `${path}.sourceMeta`));

  if (snapshot.snapshotGroupKey != null && !isString(snapshot.snapshotGroupKey)) {
    errors.push(`${path}.snapshotGroupKey 不是字符串或 null`);
  }

  return errors;
}

export function validateMarketSnapshots(marketSnapshots) {
  if (!Array.isArray(marketSnapshots)) {
    return {
      ok: false,
      errors: ["marketSnapshots 必须是数组"],
    };
  }

  const errors = marketSnapshots.flatMap((snapshot, index) => validateMarketSnapshot(snapshot, index));

  return {
    ok: errors.length === 0,
    errors,
  };
}
