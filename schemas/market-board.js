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

function isBoolean(value) {
  return typeof value === "boolean";
}

function isOptionalNumber(value) {
  return value == null || isNumber(value);
}

function isOptionalString(value) {
  return value == null || isString(value);
}

function validateMarketOutcome(outcome, path) {
  const errors = [];

  if (!isObject(outcome)) {
    return [`${path} 必须是对象`];
  }

  if (!isString(outcome.name)) {
    errors.push(`${path}.name 缺失或不是字符串`);
  }

  if (!isNumber(outcome.price)) {
    errors.push(`${path}.price 缺失或不是数字`);
  }

  if (!isOptionalNumber(outcome.point)) {
    errors.push(`${path}.point 不是数字或 null`);
  }

  return errors;
}

function validateBookmakerMarket(market, path) {
  const errors = [];

  if (!isObject(market)) {
    return [`${path} 必须是对象`];
  }

  if (!isString(market.key)) {
    errors.push(`${path}.key 缺失或不是字符串`);
  }

  if (!isString(market.lastUpdate)) {
    errors.push(`${path}.lastUpdate 缺失或不是字符串`);
  }

  if (!Array.isArray(market.outcomes)) {
    errors.push(`${path}.outcomes 缺失或不是数组`);
  } else {
    market.outcomes.forEach((outcome, index) => {
      errors.push(...validateMarketOutcome(outcome, `${path}.outcomes[${index}]`));
    });
  }

  return errors;
}

function validateOddsRecord(record, path) {
  const errors = [];

  if (!isObject(record)) {
    return [`${path} 必须是对象`];
  }

  if (!isString(record.provider)) {
    errors.push(`${path}.provider 缺失或不是字符串`);
  }

  if (!isString(record.updatedAt)) {
    errors.push(`${path}.updatedAt 缺失或不是字符串`);
  }

  if (!isObject(record.odds)) {
    errors.push(`${path}.odds 缺失或不是对象`);
  } else {
    if (!isNumber(record.odds.home)) {
      errors.push(`${path}.odds.home 缺失或不是数字`);
    }
    if (!isNumber(record.odds.draw)) {
      errors.push(`${path}.odds.draw 缺失或不是数字`);
    }
    if (!isNumber(record.odds.away)) {
      errors.push(`${path}.odds.away 缺失或不是数字`);
    }
  }

  if (record.markets != null) {
    if (!Array.isArray(record.markets)) {
      errors.push(`${path}.markets 不是数组`);
    } else {
      record.markets.forEach((market, marketIndex) => {
        errors.push(...validateBookmakerMarket(market, `${path}.markets[${marketIndex}]`));
      });
    }
  }

  return errors;
}

function validatePredictionMarketRecord(record, path) {
  const errors = [];

  if (!isObject(record)) {
    return [`${path} 必须是对象`];
  }

  if (!isString(record.provider)) {
    errors.push(`${path}.provider 缺失或不是字符串`);
  }

  if (!isString(record.updatedAt)) {
    errors.push(`${path}.updatedAt 缺失或不是字符串`);
  }

  if (!isObject(record.probabilities)) {
    errors.push(`${path}.probabilities 缺失或不是对象`);
  } else {
    if (!isNumber(record.probabilities.home)) {
      errors.push(`${path}.probabilities.home 缺失或不是数字`);
    }
    if (!isNumber(record.probabilities.draw)) {
      errors.push(`${path}.probabilities.draw 缺失或不是数字`);
    }
    if (!isNumber(record.probabilities.away)) {
      errors.push(`${path}.probabilities.away 缺失或不是数字`);
    }
  }

  for (const field of ["eventId", "marketId"]) {
    if (record[field] != null && !isIdentifier(record[field])) {
      errors.push(`${path}.${field} 不是字符串/数字`);
    }
  }

  for (const field of ["eventSlug", "marketSlug", "conditionId", "question"]) {
    if (!isOptionalString(record[field])) {
      errors.push(`${path}.${field} 不是字符串或 null`);
    }
  }

  for (const field of [
    "liquidity",
    "volume",
    "openInterest",
    "volume24hr",
    "volume1wk",
    "volume1mo",
    "volume1yr",
  ]) {
    if (!isOptionalNumber(record[field])) {
      errors.push(`${path}.${field} 不是数字或 null`);
    }
  }

  if (record.enableOrderBook != null && !isBoolean(record.enableOrderBook)) {
    errors.push(`${path}.enableOrderBook 不是布尔值或 null`);
  }

  for (const field of ["outcomes", "outcomePrices"]) {
    if (record[field] != null) {
      if (!Array.isArray(record[field])) {
        errors.push(`${path}.${field} 不是数组`);
      } else {
        record[field].forEach((value, index) => {
          if (field === "outcomes" && !isString(value)) {
            errors.push(`${path}.${field}[${index}] 不是字符串`);
          }
          if (field === "outcomePrices" && !isNumber(value)) {
            errors.push(`${path}.${field}[${index}] 不是数字`);
          }
        });
      }
    }
  }

  return errors;
}

function validateMatchRecord(match, index) {
  const path = `rawMarketBoard[${index}]`;
  const errors = [];

  if (!isObject(match)) {
    return [`${path} 必须是对象`];
  }

  if (!isIdentifier(match.id)) {
    errors.push(`${path}.id 缺失或不是字符串/数字`);
  }
  if (!isString(match.home)) {
    errors.push(`${path}.home 缺失或不是字符串`);
  }
  if (!isString(match.away)) {
    errors.push(`${path}.away 缺失或不是字符串`);
  }
  if (!isString(match.kickoff)) {
    errors.push(`${path}.kickoff 缺失或不是字符串`);
  }
  if (!Array.isArray(match.oddsProviders)) {
    errors.push(`${path}.oddsProviders 缺失或不是数组`);
  }
  if (!Array.isArray(match.predictionMarkets)) {
    errors.push(`${path}.predictionMarkets 缺失或不是数组`);
  }

  if (Array.isArray(match.oddsProviders)) {
    match.oddsProviders.forEach((record, recordIndex) => {
      errors.push(...validateOddsRecord(record, `${path}.oddsProviders[${recordIndex}]`));
    });
  }

  if (Array.isArray(match.predictionMarkets)) {
    match.predictionMarkets.forEach((record, recordIndex) => {
      errors.push(
        ...validatePredictionMarketRecord(
          record,
          `${path}.predictionMarkets[${recordIndex}]`,
        ),
      );
    });
  }

  return errors;
}

export function validateRawMarketBoard(rawMarketBoard) {
  if (!Array.isArray(rawMarketBoard)) {
    return {
      ok: false,
      errors: ["rawMarketBoard 必须是数组"],
    };
  }

  const errors = rawMarketBoard.flatMap((match, index) => validateMatchRecord(match, index));

  return {
    ok: errors.length === 0,
    errors,
  };
}
