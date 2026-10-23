import test from "node:test";
import assert from "node:assert/strict";
import {
  seedState,
  eligibility,
  validateFood,
  isStoredState,
  parseInventoryCSV,
  INVENTORY_CSV,
} from "../lib/rescue.ts";

test("ambiguous allergen declarations cannot bypass verification", () => {
  const s = seedState();
  for (const allergens of [
    "TBD",
    "pending donor confirmation",
    "milk?",
    "not provided",
    "unspecified",
  ]) {
    const food = { ...s.foods[0], allergens, verified: true };
    assert.equal(eligibility(food, s.partners[0], []).ok, false);
    assert.ok(
      validateFood(food).some((e) => e.includes("Confirm declared allergens")),
    );
  }
});
test("common spreadsheet UTF-8 BOM and header spaces are accepted", () => {
  assert.equal(
    parseInventoryCSV(
      "\uFEFF" + INVENTORY_CSV.replace("name,kg,", "name, kg ,"),
    ).length,
    2,
  );
});
test("malformed persisted collections reject cleanly rather than crashing", () => {
  const s = seedState();
  s.partners[0].storage = "Chilled";
  assert.equal(isStoredState(s), false);
  const t = seedState();
  t.foods[0].allergens = {};
  assert.equal(isStoredState(t), false);
});
