import { z } from "zod";
export const FOOD_CATEGORIES = [
  "Prepared meals",
  "Produce",
  "Bakery",
  "Dairy",
] as const;
export const FOOD_STORAGE = ["Chilled", "Ambient", "Hot"] as const;
export const ORG_ROLES = ["donor", "receiver", "both"] as const;
export type Category = (typeof FOOD_CATEGORIES)[number];
export type Storage = (typeof FOOD_STORAGE)[number];
export type Organization = {
  id: string;
  ownerId: string;
  name: string;
  role: (typeof ORG_ROLES)[number];
  description: string;
  area: string;
  timezone: string;
  capacityKg: number;
  accepting: boolean;
  receivingStart: string;
  receivingEnd: string;
  storage: Storage[];
  categories: Category[];
  requiredDiet: string;
  excludedAllergens: string[];
  discoverable: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type Listing = {
  id: string;
  ownerId: string;
  name: string;
  category: Category;
  kg: number;
  storage: Storage;
  diet: string[];
  allergens: string;
  pickupLocation: string;
  startAt: string;
  endAt: string;
  verified: boolean;
  status: "review" | "available" | "reserved" | "collected" | "withdrawn";
  assignedPickupId: string | null;
  source: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type Partnership = {
  id: string;
  orgA: string;
  orgB: string;
  requesterId: string;
  status: "pending" | "accepted" | "declined" | "ended";
  note: string;
  createdAt: string;
  updatedAt: string;
};
export type Pickup = {
  id: string;
  listingId: string;
  donorId: string;
  receiverId: string;
  status: "requested" | "approved" | "declined" | "cancelled" | "collected";
  serviceDay: string;
  windowStart: string;
  windowEnd: string;
  createdAt: string;
  updatedAt: string;
  collectedAt: string | null;
  receipt: string | null;
};
export type Notice = {
  id: string;
  userId: string;
  kind: "partnership" | "pickup" | "message";
  title: string;
  body: string;
  entityId: string;
  readAt: string | null;
  createdAt: string;
};
export type Message = {
  id: string;
  pickupId: string;
  authorId: string;
  body: string;
  createdAt: string;
};
export type User = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  emailVerifiedAt: string | null;
  emailEnabled: boolean;
};
export type Preferences = {
  partnership: boolean;
  pickup: boolean;
  message: boolean;
};
export type Workspace = {
  user: User;
  organization: Organization;
  directory: Organization[];
  partnerships: Partnership[];
  listings: Listing[];
  pickups: Pickup[];
  notifications: Notice[];
  preferences: Preferences;
  serverTime: string;
  providerConfigured: boolean;
  emailConfigured: boolean;
  emailMode: "disabled" | "owner-test" | "production";
};
export const preferencesSchema = z.object({
  partnership: z.boolean(),
  pickup: z.boolean(),
  message: z.boolean(),
});
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const organizationSchema = z
  .object({
    name: z.string().trim().min(2).max(140),
    role: z.enum(ORG_ROLES),
    description: z.string().trim().max(1000),
    area: z.string().trim().min(2).max(160),
    timezone: z
      .string()
      .max(80)
      .refine((t) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: t });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid time zone."),
    capacityKg: z.number().finite().min(0).max(10000),
    accepting: z.boolean(),
    receivingStart: time,
    receivingEnd: time,
    storage: z.array(z.enum(FOOD_STORAGE)).min(1).max(3),
    categories: z.array(z.enum(FOOD_CATEGORIES)).min(1).max(4),
    requiredDiet: z.enum(["", "vegan", "vegetarian"]),
    excludedAllergens: z.array(z.string().trim().min(1).max(60)).max(20),
    discoverable: z.boolean(),
    version: z.number().int().min(1),
  })
  .refine((p) => p.receivingEnd > p.receivingStart, {
    message:
      "Receiving end must be after start; overnight windows are not supported.",
    path: ["receivingEnd"],
  })
  .refine((p) => p.role === "donor" || !p.accepting || p.capacityKg > 0, {
    message: "Set a positive receiving capacity before accepting pickups.",
    path: ["capacityKg"],
  });
export const listingSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(140),
    category: z.enum(FOOD_CATEGORIES),
    kg: z.number().finite().positive().max(10000),
    storage: z.enum(FOOD_STORAGE),
    diet: z.array(z.enum(["vegan", "vegetarian"])).max(2),
    allergens: z.string().trim().min(1).max(300),
    pickupLocation: z.string().trim().min(2).max(250),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    verified: z.boolean(),
    source: z.string().max(6000).default(""),
    version: z.number().int().min(1).optional(),
  })
  .refine((f) => Date.parse(f.endAt) - Date.parse(f.startAt) >= 15 * 60000, {
    message: "Allow at least 15 minutes for pickup.",
    path: ["endAt"],
  })
  .refine((f) => Date.parse(f.endAt) - Date.parse(f.startAt) <= 24 * 3600000, {
    message: "Pickup windows must be within 24 hours.",
    path: ["endAt"],
  })
  .refine((f) => !f.verified || allergensKnown(f.allergens), {
    message:
      "Confirm allergens before publishing. Unknown or uncertain details must stay in review.",
    path: ["allergens"],
  });
export function allergensKnown(value: string) {
  return (
    !!value.trim() &&
    !/unknown|unconfirmed|unsure|not (known|confirmed|provided|specified)|pending|\btbd\b|unspecified|\?/i.test(
      value,
    )
  );
}
const groups = [
  ["milk", "dairy", "cheese", "butter"],
  ["wheat", "gluten"],
  ["peanut", "peanuts"],
  [
    "tree nuts",
    "tree nut",
    "almond",
    "almonds",
    "cashew",
    "cashews",
    "walnut",
    "walnuts",
  ],
  ["soy", "soya"],
  ["egg", "eggs"],
  ["fish"],
  ["shellfish", "shrimp", "prawn"],
  ["sesame"],
];
export function declaredConflict(declared: string, excluded: string[]) {
  return excluded.some((e) =>
    (groups.find((g) => g.includes(e.toLowerCase())) || [e.toLowerCase()]).some(
      (a) => declared.toLowerCase().includes(a),
    ),
  );
}
export function localParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export function receivingWindow(
  listing: Listing,
  org: Organization,
  now = new Date(),
): { start: string; end: string; day: string } | null {
  // Minute-resolution scanning handles time zones and DST without fixed offsets.
  const begin = Math.max(Date.parse(listing.startAt), now.getTime()),
    finish = Date.parse(listing.endAt);
  let first: number | null = null;
  let last = 0;
  let day = "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: org.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let t = Math.ceil(begin / 60000) * 60000; t <= finish; t += 60000) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(t)).map((p) => [p.type, p.value]),
    );
    const p = {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
    const inside = p.time >= org.receivingStart && p.time <= org.receivingEnd;
    if (inside && (!day || day === p.date)) {
      if (first === null) {
        first = t;
        day = p.date;
      }
      last = t;
    } else if (first !== null) break;
  }
  return first !== null && last - first >= 15 * 60000
    ? {
        start: new Date(first).toISOString(),
        end: new Date(last).toISOString(),
        day,
      }
    : null;
}
export function matchEligibility(
  listing: Listing,
  receiver: Organization,
  usedKg: number,
  connected: boolean,
  now = new Date(),
) {
  const blocked: string[] = [];
  if (!connected) blocked.push("An accepted partnership is required.");
  if (listing.ownerId === receiver.id)
    blocked.push("A different organization must receive this food.");
  if (
    listing.status !== "available" ||
    !listing.verified ||
    !allergensKnown(listing.allergens)
  )
    blocked.push("This listing is not verified and available.");
  if (Date.parse(listing.endAt) <= now.getTime())
    blocked.push("The pickup window has expired.");
  if (receiver.role === "donor" || !receiver.accepting)
    blocked.push("This partner is not accepting pickups.");
  if (!receiver.categories.includes(listing.category))
    blocked.push("Food category is not accepted.");
  if (!receiver.storage.includes(listing.storage))
    blocked.push(`${listing.storage} storage is unavailable.`);
  if (
    receiver.requiredDiet &&
    !listing.diet.some(
      (d) =>
        d === receiver.requiredDiet ||
        (receiver.requiredDiet === "vegetarian" && d === "vegan"),
    )
  )
    blocked.push(`${receiver.requiredDiet} requirement is not verified.`);
  if (declaredConflict(listing.allergens, receiver.excludedAllergens))
    blocked.push("Declared allergens conflict with partner restrictions.");
  if (usedKg + listing.kg > receiver.capacityKg + 0.00001)
    blocked.push("Not enough remaining receiving capacity.");
  const window = receivingWindow(listing, receiver, now);
  if (!window)
    blocked.push("No receiving window overlaps pickup by at least 15 minutes.");
  return {
    ok: blocked.length === 0,
    blocked,
    window,
    reasons: [
      `${listing.storage} storage supported`,
      `${Math.max(0, receiver.capacityKg - usedKg).toLocaleString()} kg receiving capacity remains`,
      "Category, diet, and declared allergens checked",
      "Accepted community partnership",
      "At least 15 minutes of pickup overlap",
    ],
  };
}
export function canDonate(org: Organization) {
  return org.role === "donor" || org.role === "both";
}
export function isConnected(a: string, b: string, partnerships: Partnership[]) {
  return partnerships.some(
    (p) =>
      p.status === "accepted" &&
      ((p.orgA === a && p.orgB === b) || (p.orgA === b && p.orgB === a)),
  );
}
export function usedOnDay(
  receiverId: string,
  day: string,
  pickups: Pickup[],
  listings: Listing[],
) {
  return pickups
    .filter(
      (p) =>
        p.receiverId === receiverId &&
        p.serviceDay === day &&
        ["approved", "collected"].includes(p.status),
    )
    .reduce(
      (n, p) => n + (listings.find((f) => f.id === p.listingId)?.kg || 0),
      0,
    );
}
