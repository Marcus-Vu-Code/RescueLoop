import test from "node:test";
import assert from "node:assert/strict";
import {
  seedState,
  generateMatches,
  eligibility,
  approveMatch,
  collectFood,
  impact,
  usedCapacity,
  parseNote,
  parseInventoryCSV,
  parsePartnersCSV,
  csvRows,
  csvExport,
  isStoredState,
  validateFood,
  INVENTORY_CSV,
  PARTNERS_CSV,
  SAMPLE_NOTE,
} from "../lib/rescue.ts";

test("sample workspace is valid; matches five verified batches and blocks the unknown soup", () => {
  const s = seedState();
  assert.equal(isStoredState(s), true);
  const result = generateMatches(s.foods, s.partners);
  assert.equal(result.matches.length, 5);
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.unmatched[0].foodId, "f6");
  assert.equal(result.matches[0].foodId, "f1");
  assert.equal(result.matches[0].partnerId, "p1");
  for (const p of s.partners) {
    const allocated = result.matches
      .filter((m) => m.partnerId === p.id)
      .reduce((n, m) => n + s.foods.find((f) => f.id === m.foodId).kg, 0);
    assert.ok(allocated <= p.capacity);
  }
});
test("approval reserves capacity; collection updates impact once and keeps daily capacity used", () => {
  let s = seedState();
  const before = impact(s.foods);
  const match = generateMatches(s.foods, s.partners).matches[0];
  s = approveMatch(s, match);
  assert.deepEqual(impact(s.foods), before);
  assert.equal(usedCapacity("p1", s.foods), 24);
  assert.throws(() => approveMatch(s, match), /not available/);
  s = collectFood(s, match.foodId);
  assert.equal(impact(s.foods).kg, before.kg + 24);
  assert.equal(impact(s.foods).meals, before.meals + 48);
  assert.equal(usedCapacity("p1", s.foods), 24);
  assert.throws(() => collectFood(s, match.foodId), /Only an approved/);
});
test("approval rechecks changed capacity and never overbooks", () => {
  const s = seedState(),
    match = generateMatches(s.foods, s.partners).matches[0];
  s.partners[0].capacity = 10;
  assert.throws(() => approveMatch(s, match), /capacity remains/);
});
test("all match approvals can be completed and collected without duplicate allocations", () => {
  let s = seedState(),
    count = 0;
  while (true) {
    const m = generateMatches(s.foods, s.partners).matches[0];
    if (!m) break;
    s = approveMatch(s, m);
    count++;
    assert.ok(count < 10);
  }
  assert.equal(count, 5);
  for (const p of s.partners)
    assert.ok(usedCapacity(p.id, s.foods) <= p.capacity);
  for (const f of s.foods.filter((f) => f.status === "reserved"))
    s = collectFood(s, f.id);
  assert.equal(impact(s.foods).kg, 213);
  assert.equal(impact(s.foods).meals, 426);
  assert.equal(impact(s.foods).today, 89);
});
test("storage, diets, allergens, pickup overlap, paused partners and review state are hard gates", () => {
  const s = seedState(),
    f = s.foods[0],
    p = s.partners[0];
  const check = (food = {}, partner = {}) =>
    eligibility({ ...f, ...food }, { ...p, ...partner }, []).ok;
  assert.equal(check(), true);
  assert.equal(check({ verified: false }), false);
  assert.equal(check({ allergens: "unknown" }), false);
  assert.equal(check({}, { active: false }), false);
  assert.equal(check({ storage: "Hot" }), false);
  assert.equal(check({}, { start: "16:00" }), false);
  assert.equal(check({}, { start: "15:46" }), false);
  assert.equal(check({}, { start: "15:45" }), true);
  assert.equal(check({}, { excludedAllergens: ["soy"] }), false);
  assert.equal(
    check({ allergens: "milk" }, { excludedAllergens: ["dairy"] }),
    false,
  );
  assert.equal(
    check({ allergens: "almonds" }, { excludedAllergens: ["tree nuts"] }),
    false,
  );
  assert.equal(check({ diet: [] }, { requiredDiet: "vegan" }), false);
  assert.equal(check({}, { requiredDiet: "vegetarian" }), true);
  assert.equal(check({ status: "review" }), false);
  assert.equal(check({ date: "2026-10-22" }), false);
  assert.equal(check({ kg: 0 }), false);
  assert.equal(check({}, { categories: ["Bakery"] }), false);
});
test("offline parser structures explicit labeled facts but never verifies or infers missing safety facts", () => {
  const d = parseNote(SAMPLE_NOTE);
  assert.equal(d.kg, 24);
  assert.equal(d.name, "vegetable rice");
  assert.equal(d.category, "Prepared meals");
  assert.equal(d.allergens, "soy");
  assert.deepEqual(d.diet, ["vegan"]);
  assert.equal(d.storage, "Chilled");
  assert.equal(d.verified, false);
  assert.equal(d.start, "15:00");
  assert.equal(d.end, "16:30");
  assert.equal(validateFood(d).length, 0);
  const unknown = parseNote("20 kg vegan salad");
  assert.equal(unknown.allergens, "unknown");
  assert.equal(unknown.storage, undefined);
  assert.deepEqual(unknown.diet, []);
  assert.equal(unknown.verified, false);
  assert.equal(parseNote("10 lbs apples").kg, 4.54);
});
test("CSV import validates every row atomically; imported foods always need review", () => {
  const rows = parseInventoryCSV(INVENTORY_CSV);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((f) => !f.verified && f.status === "review"));
  assert.throws(
    () => parseInventoryCSV(INVENTORY_CSV.replace("rice,24", "rice,-24")),
    /Row 2/,
  );
  assert.throws(
    () => parseInventoryCSV("name,kg\nBad,24"),
    /Missing CSV column/,
  );
  assert.throws(
    () => parseInventoryCSV(INVENTORY_CSV.replace("16:30", "14:00")),
    /Pickup end/,
  );
  assert.throws(
    () => parseInventoryCSV(INVENTORY_CSV.replace("Chilled", "Freezer")),
    /storage/,
  );
  assert.deepEqual(csvRows('a,b\r\n"hello, world","line\n2"'), [
    ["a", "b"],
    ["hello, world", "line\n2"],
  ]);
  assert.throws(() => csvRows('a,"unfinished'), /unclosed/);
});
test("partner capacity CSV enforces supported storage, category, windows and numeric capacity", () => {
  const partners = parsePartnersCSV(PARTNERS_CSV);
  assert.equal(partners.length, 1);
  assert.equal(partners[0].capacity, 40);
  assert.deepEqual(partners[0].storage, ["Chilled", "Ambient"]);
  assert.throws(
    () => parsePartnersCSV(PARTNERS_CSV.replace(",40,", ",-1,")),
    /Capacity/,
  );
  assert.throws(
    () => parsePartnersCSV(PARTNERS_CSV.replace("14:00", "22:00")),
    /receiving window/,
  );
});
test("CSV exports quote fields and neutralize spreadsheet formulas", () => {
  const csv = csvExport([["=1+1", "@SUM(A1)", 'a"b', 12]]);
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\'@SUM(A1)"'));
  assert.ok(csv.includes('"a""b"'));
});
test("untrusted saved data is rejected without losing a valid sample seed", () => {
  assert.equal(isStoredState(null), false);
  assert.equal(
    isStoredState({ version: 1, foods: [{}], partners: [], activity: [] }),
    false,
  );
  const s = seedState();
  s.foods[0].kg = -1;
  assert.equal(isStoredState(s), false);
  assert.equal(isStoredState(seedState()), true);
});
