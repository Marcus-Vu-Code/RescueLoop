export type Category = "Prepared meals" | "Produce" | "Bakery" | "Dairy";
export type Storage = "Chilled" | "Ambient" | "Hot";
export type Food = {
  id: string;
  name: string;
  category: Category;
  kg: number;
  location: string;
  start: string;
  end: string;
  storage: Storage;
  diet: string[];
  allergens: string;
  verified: boolean;
  status: "available" | "reserved" | "collected" | "review";
  source?: string;
  partnerId?: string;
  date: string;
  collectedAt?: string;
};
export type Partner = {
  id: string;
  name: string;
  description: string;
  capacity: number;
  start: string;
  end: string;
  storage: Storage[];
  categories: Category[];
  excludedAllergens: string[];
  requiredDiet: string;
  distance: number;
  active: boolean;
  initials: string;
  color: string;
};
export type Activity = {
  id: string;
  text: string;
  time: string;
  kind: "collection" | "approval" | "listing" | "review";
};
export type State = {
  version: 1;
  foods: Food[];
  partners: Partner[];
  activity: Activity[];
};
export type Match = {
  foodId: string;
  partnerId: string;
  reasons: string[];
  distance: number;
  pickup: string;
};
export const DEMO_DATE = "2026-10-23";
export const DEMO_TIME = "14:30";
export const CATEGORIES: Category[] = [
  "Prepared meals",
  "Produce",
  "Bakery",
  "Dairy",
];
export const STORAGES: Storage[] = ["Chilled", "Ambient", "Hot"];
export const SAMPLE_NOTE =
  "24 kg vegetable rice; category: Prepared meals; location: Dining Commons; pickup: 15:00–16:30; storage: Chilled; diet: vegan; allergens: soy";
export const INVENTORY_CSV =
  "name,kg,category,location,start,end,storage,diet,allergens\nVegetable rice,24,Prepared meals,Dining Commons,15:00,16:30,Chilled,vegan,soy\nSeasonal fruit,12,Produce,Student Union,15:30,18:00,Ambient,vegan,none declared";
export const PARTNERS_CSV =
  "name,capacity,start,end,storage,categories,excludedAllergens,requiredDiet,distance\nCommunity Table,40,14:00,18:00,Chilled|Ambient,Prepared meals|Produce|Bakery,peanuts,,1.2";
export function seedState(): State {
  return {
    version: 1,
    partners: [
      {
        id: "p1",
        name: "Spartan Community Pantry",
        description: "Student-led campus pantry",
        capacity: 45,
        start: "14:00",
        end: "18:00",
        storage: ["Chilled", "Ambient"],
        categories: [...CATEGORIES],
        excludedAllergens: ["peanuts"],
        requiredDiet: "",
        distance: 0.4,
        active: true,
        initials: "SP",
        color: "green",
      },
      {
        id: "p2",
        name: "Community Table",
        description: "Neighborhood meal program",
        capacity: 35,
        start: "15:00",
        end: "17:30",
        storage: ["Hot", "Chilled", "Ambient"],
        categories: ["Prepared meals", "Produce", "Bakery"],
        excludedAllergens: [],
        requiredDiet: "",
        distance: 1.2,
        active: true,
        initials: "CT",
        color: "orange",
      },
      {
        id: "p3",
        name: "Green Plate Collective",
        description: "Plant-based community kitchen",
        capacity: 40,
        start: "15:30",
        end: "18:30",
        storage: ["Chilled", "Ambient"],
        categories: ["Prepared meals", "Produce", "Bakery"],
        excludedAllergens: ["milk", "dairy"],
        requiredDiet: "vegan",
        distance: 1.8,
        active: true,
        initials: "GP",
        color: "purple",
      },
    ],
    foods: [
      {
        id: "f1",
        name: "Vegetable rice bowls",
        category: "Prepared meals",
        kg: 24,
        location: "Dining Commons",
        start: "15:00",
        end: "16:00",
        storage: "Chilled",
        diet: ["vegan"],
        allergens: "soy",
        verified: true,
        status: "available",
        date: DEMO_DATE,
      },
      {
        id: "f2",
        name: "Fresh garden vegetables",
        category: "Produce",
        kg: 18,
        location: "Campus Market",
        start: "15:00",
        end: "17:30",
        storage: "Chilled",
        diet: ["vegan"],
        allergens: "none declared",
        verified: true,
        status: "available",
        date: DEMO_DATE,
      },
      {
        id: "f3",
        name: "Assorted deli sandwiches",
        category: "Prepared meals",
        kg: 15,
        location: "Student Union",
        start: "15:00",
        end: "16:30",
        storage: "Chilled",
        diet: ["vegetarian"],
        allergens: "wheat, milk, eggs",
        verified: true,
        status: "available",
        date: DEMO_DATE,
      },
      {
        id: "f4",
        name: "Seasonal fruit boxes",
        category: "Produce",
        kg: 12,
        location: "Dining Commons",
        start: "15:30",
        end: "18:00",
        storage: "Ambient",
        diet: ["vegan"],
        allergens: "none declared",
        verified: true,
        status: "available",
        date: DEMO_DATE,
      },
      {
        id: "f5",
        name: "Freshly baked sourdough",
        category: "Bakery",
        kg: 20,
        location: "Campus Bakery",
        start: "16:00",
        end: "18:30",
        storage: "Ambient",
        diet: ["vegan"],
        allergens: "wheat",
        verified: true,
        status: "available",
        date: DEMO_DATE,
      },
      {
        id: "f6",
        name: "Roasted tomato soup",
        category: "Prepared meals",
        kg: 9,
        location: "Dining Commons",
        start: "15:00",
        end: "17:00",
        storage: "Chilled",
        diet: [],
        allergens: "unknown",
        verified: false,
        status: "review",
        date: DEMO_DATE,
        source:
          "9kg tomato soup from Dining Commons. Chilled. Pickup 15:00–17:00. Ingredients to be confirmed.",
      },
      ...[24, 32, 28, 40].map((kg, i): Food => ({
        id: `history${i}`,
        name: [
          "Harvest lunch bowls",
          "Market produce boxes",
          "Campus bakery assortment",
          "Community lunch trays",
        ][i],
        category: i === 1 ? "Produce" : i === 2 ? "Bakery" : "Prepared meals",
        kg,
        location: "Campus dining",
        start: "12:00",
        end: "15:00",
        storage: "Chilled",
        diet: [],
        allergens: "none declared",
        verified: true,
        status: "collected",
        partnerId: `p${(i % 3) + 1}`,
        date: `2026-10-${19 + i}`,
        collectedAt: `2026-10-${19 + i}T15:00:00-07:00`,
      })),
    ],
    activity: [
      {
        id: "a1",
        text: "Tomato soup flagged for allergen review",
        time: "14:24",
        kind: "review",
      },
      {
        id: "a2",
        text: "Campus Bakery added 20 kg of sourdough",
        time: "14:18",
        kind: "listing",
      },
      {
        id: "a3",
        text: "Dining Commons added 24 kg of rice bowls",
        time: "14:05",
        kind: "listing",
      },
    ],
  };
}
export function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function timeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
export function formatKg(kg: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
    kg,
  );
}
export function usedCapacity(partnerId: string, foods: Food[]): number {
  return foods
    .filter(
      (f) =>
        f.partnerId === partnerId &&
        f.date === DEMO_DATE &&
        ["reserved", "collected"].includes(f.status),
    )
    .reduce((n, f) => n + f.kg, 0);
}
const ALLERGEN_GROUPS = [
  ["milk", "dairy", "cheese", "butter"],
  ["wheat", "gluten"],
  ["peanut", "peanuts"],
  [
    "tree nut",
    "tree nuts",
    "almond",
    "almonds",
    "walnut",
    "walnuts",
    "cashew",
    "cashews",
  ],
  ["soy", "soya"],
  ["egg", "eggs"],
  ["fish"],
  ["shellfish", "shrimp", "prawn"],
  ["sesame"],
];
function allergenConflict(declared: string, excluded: string): boolean {
  const a = declared.toLowerCase(),
    b = excluded.toLowerCase().trim();
  if (!b) return false;
  const group = ALLERGEN_GROUPS.find((g) => g.includes(b));
  return (group || [b]).some(
    (word) =>
      a.split(/[,;|]/).some((part) => part.trim() === word) || a.includes(word),
  );
}
function knownAllergens(value: unknown): boolean {
  return (
    typeof value === "string" &&
    !!value.trim() &&
    !/unknown|unconfirmed|unsure|not (known|confirmed|provided|specified)|pending|\btbd\b|unspecified|\?/i.test(
      value,
    )
  );
}
export function eligibility(
  food: Food,
  partner: Partner,
  foods: Food[],
  extraUsed = 0,
): { ok: boolean; reasons: string[]; blocked: string[] } {
  const blocked: string[] = [];
  if (!partner.active) blocked.push("Partner is paused");
  if (food.status !== "available") blocked.push("Listing is not available");
  if (food.date !== DEMO_DATE) blocked.push("Listing is outside the demo date");
  if (!food.verified || !knownAllergens(food.allergens))
    blocked.push("Handling and allergens need human verification");
  if (!Number.isFinite(food.kg) || food.kg <= 0)
    blocked.push("Weight must be positive");
  if (!partner.categories.includes(food.category))
    blocked.push("Food category is not accepted");
  if (!partner.storage.includes(food.storage))
    blocked.push(`${food.storage} storage is unavailable`);
  if (
    partner.requiredDiet &&
    !food.diet.some(
      (d) =>
        d.toLowerCase() === partner.requiredDiet.toLowerCase() ||
        (partner.requiredDiet.toLowerCase() === "vegetarian" &&
          d.toLowerCase() === "vegan"),
    )
  )
    blocked.push(`${partner.requiredDiet} requirement is not verified`);
  if (
    partner.excludedAllergens.some((a) => allergenConflict(food.allergens, a))
  )
    blocked.push("Declared allergens conflict with partner restrictions");
  const start = Math.max(
    minutes(food.start),
    minutes(partner.start),
    minutes(DEMO_TIME),
  );
  const end = Math.min(minutes(food.end), minutes(partner.end));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 15)
    blocked.push("No overlapping pickup window of at least 15 minutes");
  const remaining =
    partner.capacity - usedCapacity(partner.id, foods) - extraUsed;
  if (food.kg > remaining + 0.0001)
    blocked.push(
      `Only ${formatKg(Math.max(0, remaining))} kg of capacity remains`,
    );
  const label = (n: number) =>
    timeLabel(
      `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`,
    );
  return {
    ok: !blocked.length,
    blocked,
    reasons: [
      `${food.storage} storage confirmed`,
      `${formatKg(remaining)} kg capacity available`,
      `${label(start)}–${label(end)} pickup window`,
      partner.requiredDiet
        ? `Verified ${partner.requiredDiet} listing`
        : "Dietary and allergen constraints checked",
    ],
  };
}
export function generateMatches(
  foods: Food[],
  partners: Partner[],
): { matches: Match[]; unmatched: { foodId: string; reasons: string[] }[] } {
  const reserved: Record<string, number> = {};
  const matches: Match[] = [];
  const unmatched: { foodId: string; reasons: string[] }[] = [];
  const ordered = foods
    .filter(
      (f) => f.date === DEMO_DATE && ["available", "review"].includes(f.status),
    )
    .sort(
      (a, b) => minutes(a.end) - minutes(b.end) || a.id.localeCompare(b.id),
    );
  for (const food of ordered) {
    const candidates = partners
      .map((p) => ({
        p,
        check: eligibility(food, p, foods, reserved[p.id] || 0),
      }))
      .filter((c) => c.check.ok)
      .sort(
        (a, b) => a.p.distance - b.p.distance || a.p.id.localeCompare(b.p.id),
      );
    if (!candidates.length) {
      unmatched.push({
        foodId: food.id,
        reasons: !food.verified
          ? ["Handling and allergens need human verification"]
          : partners.length
            ? [
                ...new Set(
                  partners.flatMap(
                    (p) =>
                      eligibility(food, p, foods, reserved[p.id] || 0).blocked,
                  ),
                ),
              ]
            : ["Add an active receiving partner"],
      });
      continue;
    }
    const { p, check } = candidates[0];
    reserved[p.id] = (reserved[p.id] || 0) + food.kg;
    matches.push({
      foodId: food.id,
      partnerId: p.id,
      reasons: check.reasons,
      distance: p.distance,
      pickup: timeLabel(food.start),
    });
  }
  return { matches, unmatched };
}
export function approveMatch(state: State, match: Match): State {
  const food = state.foods.find((f) => f.id === match.foodId);
  const partner = state.partners.find((p) => p.id === match.partnerId);
  if (!food || !partner)
    throw new Error("This listing or partner no longer exists.");
  const check = eligibility(food, partner, state.foods);
  if (!check.ok) throw new Error(check.blocked.join(". "));
  return {
    ...state,
    foods: state.foods.map((f) =>
      f.id === food.id
        ? { ...f, status: "reserved", partnerId: partner.id }
        : f,
    ),
    activity: [
      {
        id: crypto.randomUUID(),
        text: `${food.name} approved for ${partner.name}`,
        time: "Just now",
        kind: "approval" as const,
      },
      ...state.activity,
    ].slice(0, 60),
  };
}
export function collectFood(state: State, id: string): State {
  const food = state.foods.find((f) => f.id === id);
  if (!food || food.status !== "reserved")
    throw new Error("Only an approved pickup can be marked collected.");
  return {
    ...state,
    foods: state.foods.map((f) =>
      f.id === id
        ? { ...f, status: "collected", collectedAt: new Date().toISOString() }
        : f,
    ),
    activity: [
      {
        id: crypto.randomUUID(),
        text: `${formatKg(food.kg)} kg of ${food.name.toLowerCase()} collected`,
        time: "Just now",
        kind: "collection" as const,
      },
      ...state.activity,
    ].slice(0, 60),
  };
}
export function impact(foods: Food[]) {
  const collected = foods.filter((f) => f.status === "collected");
  const kg = collected.reduce((n, f) => n + f.kg, 0);
  return {
    kg,
    meals: Math.floor(kg / 0.5),
    pickups: collected.length,
    today: collected
      .filter((f) => f.date === DEMO_DATE)
      .reduce((n, f) => n + f.kg, 0),
  };
}
export function validateFood(raw: Partial<Food>): string[] {
  const errors: string[] = [];
  if (typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 140)
    errors.push("Enter a food name of 1–140 characters.");
  if (!Number.isFinite(raw.kg) || Number(raw.kg) <= 0 || Number(raw.kg) > 10000)
    errors.push("Weight must be between 0 and 10,000 kg.");
  if (!CATEGORIES.includes(raw.category as Category))
    errors.push("Choose a food category.");
  if (
    typeof raw.location !== "string" ||
    !raw.location.trim() ||
    raw.location.length > 200
  )
    errors.push("Enter a pickup location of 1–200 characters.");
  if (!STORAGES.includes(raw.storage as Storage))
    errors.push("Choose a storage type.");
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.start || "") ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.end || "") ||
    minutes(raw.end!) <= minutes(raw.start!)
  )
    errors.push("Pickup end must be after the start on the demo day.");
  if (typeof raw.allergens !== "string" || raw.allergens.length > 300)
    errors.push("Allergen details must be text of at most 300 characters.");
  if (raw.verified && !knownAllergens(raw.allergens))
    errors.push("Confirm declared allergens before verifying this listing.");
  return errors;
}
export function parseNote(note: string): Partial<Food> {
  const fields: Record<string, string> = {};
  for (const part of note.split(/[;\n]/)) {
    const m = part
      .trim()
      .match(/^(category|location|pickup|storage|diet|allergens)\s*:\s*(.+)$/i);
    if (m) fields[m[1].toLowerCase()] = m[2].trim();
  }
  const first = note.split(/[;\n]/)[0].trim();
  const weight = first.match(
    /(\d+(?:\.\d+)?)\s*(kg|kilograms?|lbs?|pounds?)\b/i,
  );
  const times =
    (fields.pickup || note).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g) || [];
  const normalize = (t: string) => t.padStart(5, "0");
  return {
    name: first
      .replace(/(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|kilograms?|lbs?|pounds?)\b/i, "")
      .trim(),
    kg: weight
      ? Math.round(
          Number(weight[1]) *
            (/lb|pound/i.test(weight[2]) ? 0.453592 : 1) *
            100,
        ) / 100
      : undefined,
    category: CATEGORIES.find(
      (c) => c.toLowerCase() === fields.category?.toLowerCase(),
    ),
    location: fields.location || "",
    start: times[0] ? normalize(times[0]) : "",
    end: times[1] ? normalize(times[1]) : "",
    storage: STORAGES.find(
      (s) => s.toLowerCase() === fields.storage?.toLowerCase(),
    ),
    diet: fields.diet
      ? fields.diet
          .toLowerCase()
          .split(/[,|]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    allergens: fields.allergens || "unknown",
    verified: false,
    source: note,
  };
}
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseInventoryCSV(text: string): Food[] {
  const [header, ...rows] = csvRows(text.replace(/^\uFEFF/, "")).map(
    (row, i) => (i === 0 ? row.map((cell) => cell.trim()) : row),
  );
  if (!header || !rows.length)
    throw new Error("CSV must include a header and at least one listing.");
  if (rows.length > 100)
    throw new Error("Import at most 100 listings at a time.");
  for (const key of [
    "name",
    "kg",
    "category",
    "location",
    "start",
    "end",
    "storage",
    "allergens",
  ])
    if (!header.includes(key)) throw new Error(`Missing CSV column: ${key}`);
  return rows.map((row, i) => {
    const r = Object.fromEntries(
      header.map((h, j) => [h.trim(), row[j]?.trim() || ""]),
    );
    const f: Food = {
      id: crypto.randomUUID(),
      name: r.name,
      kg: Number(r.kg),
      category: r.category as Category,
      location: r.location,
      start: r.start,
      end: r.end,
      storage: r.storage as Storage,
      diet: (r.diet || "").split("|").filter(Boolean),
      allergens: r.allergens || "unknown",
      verified: false,
      status: "review",
      date: DEMO_DATE,
      source: `CSV import, row ${i + 2}`,
    };
    const errors = validateFood(f);
    if (errors.length) throw new Error(`Row ${i + 2}: ${errors.join(" ")}`);
    return f;
  });
}
export function parsePartnersCSV(text: string): Partner[] {
  const [header, ...rows] = csvRows(text.replace(/^\uFEFF/, "")).map(
    (row, i) => (i === 0 ? row.map((cell) => cell.trim()) : row),
  );
  if (!header || !rows.length)
    throw new Error("CSV must include a header and at least one partner.");
  if (rows.length > 100) throw new Error("Import at most 100 partners.");
  for (const key of [
    "name",
    "capacity",
    "start",
    "end",
    "storage",
    "categories",
    "distance",
  ])
    if (!header.includes(key)) throw new Error(`Missing CSV column: ${key}`);
  return rows.map((row, i) => {
    const r = Object.fromEntries(
      header.map((h, j) => [h.trim(), row[j]?.trim() || ""]),
    );
    const p: Partner = {
      id: crypto.randomUUID(),
      name: r.name,
      description: "Imported community partner",
      capacity: Number(r.capacity),
      start: r.start,
      end: r.end,
      storage: r.storage.split("|") as Storage[],
      categories: r.categories.split("|") as Category[],
      excludedAllergens: (r.excludedAllergens || "").split("|").filter(Boolean),
      requiredDiet: r.requiredDiet || "",
      distance: Number(r.distance),
      active: true,
      initials: r.name
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase(),
      color: "green",
    };
    const errors = validatePartner(p);
    if (errors.length) throw new Error(`Row ${i + 2}: ${errors.join(" ")}`);
    return p;
  });
}
export function validatePartner(p: Partial<Partner>): string[] {
  const e: string[] = [];
  if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 140)
    e.push("Enter a partner name of 1–140 characters.");
  if (
    !Number.isFinite(p.capacity) ||
    Number(p.capacity) <= 0 ||
    Number(p.capacity) > 10000
  )
    e.push("Capacity must be between 0 and 10,000 kg.");
  if (
    !Number.isFinite(p.distance) ||
    Number(p.distance) < 0 ||
    Number(p.distance) > 100
  )
    e.push("Distance must be 0–100 km.");
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start || "") ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.end || "") ||
    minutes(p.end!) <= minutes(p.start!)
  )
    e.push("Enter a valid receiving window.");
  if (
    !Array.isArray(p.storage) ||
    !p.storage.length ||
    p.storage.some((s) => !STORAGES.includes(s))
  )
    e.push("Choose at least one supported storage type.");
  if (
    !Array.isArray(p.categories) ||
    !p.categories.length ||
    p.categories.some((c) => !CATEGORIES.includes(c))
  )
    e.push("Choose at least one supported category.");
  return e;
}
export function csvExport(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map(
          (value) =>
            `"${String(value)
              .replace(/^[=+@\-\t\r]/, "'$&")
              .replaceAll('"', '""')}"`,
        )
        .join(","),
    )
    .join("\r\n");
}
export function isStoredState(value: unknown): value is State {
  if (!value || typeof value !== "object") return false;
  const s = value as State;
  return (
    s.version === 1 &&
    Array.isArray(s.foods) &&
    s.foods.length <= 1000 &&
    s.foods.every(
      (f) =>
        f &&
        typeof f.id === "string" &&
        ["available", "reserved", "collected", "review"].includes(f.status) &&
        typeof f.verified === "boolean" &&
        Array.isArray(f.diet) &&
        f.diet.every((d) => typeof d === "string") &&
        typeof f.date === "string" &&
        validateFood(f).length === 0,
    ) &&
    Array.isArray(s.partners) &&
    s.partners.length <= 200 &&
    s.partners.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.active === "boolean" &&
        Array.isArray(p.excludedAllergens) &&
        p.excludedAllergens.every((a) => typeof a === "string") &&
        typeof p.requiredDiet === "string" &&
        validatePartner(p).length === 0,
    ) &&
    Array.isArray(s.activity) &&
    s.activity.length <= 100 &&
    s.activity.every(
      (a) => a && typeof a.text === "string" && typeof a.time === "string",
    )
  );
}
