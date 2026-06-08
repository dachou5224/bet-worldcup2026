import test from "node:test";
import assert from "node:assert/strict";
import { HOW_COMPUTED_GUIDE } from "../app/content/how-computed-guide.js";

test("how-computed guide uses plain-language paragraphs", () => {
  assert.ok(Array.isArray(HOW_COMPUTED_GUIDE.paragraphs));
  assert.ok(HOW_COMPUTED_GUIDE.paragraphs.length >= 4);
  assert.ok(HOW_COMPUTED_GUIDE.footer.includes("不构成"));

  for (const paragraph of HOW_COMPUTED_GUIDE.paragraphs) {
    assert.ok(paragraph.length > 20);
    assert.equal(paragraph.includes("P_market"), false);
    assert.equal(paragraph.includes("decision-layer"), false);
  }
});
