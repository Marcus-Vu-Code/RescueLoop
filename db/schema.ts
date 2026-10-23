import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const accounts = sqliteTable(
  "rl_accounts",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("displayName").notNull(),
    passwordHash: text("passwordHash").notNull(),
    recoveryHash: text("recoveryHash").notNull(),
    preferences: text("preferences")
      .notNull()
      .default('{"partnership":true,"pickup":true,"message":true}'),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (t) => [uniqueIndex("rl_accounts_email").on(t.email)],
);
export const sessions = sqliteTable(
  "rl_sessions",
  {
    hash: text("hash").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    expiresAt: text("expiresAt").notNull(),
    createdAt: text("createdAt").notNull(),
  },
  (t) => [
    index("rl_sessions_user").on(t.userId),
    index("rl_sessions_expiry").on(t.expiresAt),
  ],
);
export const organizations = sqliteTable(
  "rl_organizations",
  {
    id: text("id").primaryKey(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => accounts.id),
    name: text("name").notNull(),
    role: text("role").notNull(),
    description: text("description").notNull().default(""),
    area: text("area").notNull(),
    timezone: text("timezone").notNull().default("America/Los_Angeles"),
    capacityKg: real("capacityKg").notNull().default(0),
    accepting: integer("accepting").notNull().default(0),
    receivingStart: text("receivingStart").notNull().default("09:00"),
    receivingEnd: text("receivingEnd").notNull().default("18:00"),
    storage: text("storage").notNull().default('["Chilled","Ambient"]'),
    categories: text("categories")
      .notNull()
      .default('["Prepared meals","Produce","Bakery","Dairy"]'),
    requiredDiet: text("requiredDiet").notNull().default(""),
    excludedAllergens: text("excludedAllergens").notNull().default("[]"),
    discoverable: integer("discoverable").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (t) => [
    uniqueIndex("rl_organization_owner").on(t.ownerId),
    index("rl_organization_discovery").on(t.discoverable),
  ],
);
export const partnerships = sqliteTable(
  "rl_partnerships",
  {
    id: text("id").primaryKey(),
    orgA: text("orgA")
      .notNull()
      .references(() => organizations.id),
    orgB: text("orgB")
      .notNull()
      .references(() => organizations.id),
    requesterId: text("requesterId")
      .notNull()
      .references(() => organizations.id),
    status: text("status").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (t) => [
    uniqueIndex("rl_partnership_pair").on(t.orgA, t.orgB),
    index("rl_partnership_b").on(t.orgB),
  ],
);
export const listings = sqliteTable(
  "rl_listings",
  {
    id: text("id").primaryKey(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    kg: real("kg").notNull(),
    storage: text("storage").notNull(),
    diet: text("diet").notNull().default("[]"),
    allergens: text("allergens").notNull(),
    pickupLocation: text("pickupLocation").notNull(),
    startAt: text("startAt").notNull(),
    endAt: text("endAt").notNull(),
    verified: integer("verified").notNull(),
    status: text("status").notNull(),
    assignedPickupId: text("assignedPickupId"),
    source: text("source").notNull().default(""),
    version: integer("version").notNull().default(1),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (t) => [
    index("rl_listing_owner").on(t.ownerId),
    index("rl_listing_available").on(t.status, t.endAt),
  ],
);
export const pickups = sqliteTable(
  "rl_pickups",
  {
    id: text("id").primaryKey(),
    listingId: text("listingId")
      .notNull()
      .references(() => listings.id),
    donorId: text("donorId")
      .notNull()
      .references(() => organizations.id),
    receiverId: text("receiverId")
      .notNull()
      .references(() => organizations.id),
    status: text("status").notNull(),
    serviceDay: text("serviceDay").notNull(),
    windowStart: text("windowStart").notNull(),
    windowEnd: text("windowEnd").notNull(),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    collectedAt: text("collectedAt"),
    receipt: text("receipt"),
  },
  (t) => [
    uniqueIndex("rl_active_pickup_request")
      .on(t.listingId, t.receiverId)
      .where(sql`${t.status} in ('requested','approved')`),
    index("rl_pickup_capacity").on(t.receiverId, t.serviceDay, t.status),
    index("rl_pickup_donor").on(t.donorId),
  ],
);
export const messages = sqliteTable(
  "rl_messages",
  {
    id: text("id").primaryKey(),
    pickupId: text("pickupId")
      .notNull()
      .references(() => pickups.id),
    authorId: text("authorId")
      .notNull()
      .references(() => organizations.id),
    body: text("body").notNull(),
    createdAt: text("createdAt").notNull(),
  },
  (t) => [index("rl_message_thread").on(t.pickupId, t.createdAt)],
);
export const notifications = sqliteTable(
  "rl_notifications",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => accounts.id),
    eventKey: text("eventKey").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    entityId: text("entityId").notNull(),
    readAt: text("readAt"),
    createdAt: text("createdAt").notNull(),
  },
  (t) => [
    uniqueIndex("rl_notification_event").on(t.userId, t.eventKey),
    index("rl_notification_user").on(t.userId, t.createdAt),
  ],
);
export const rateLimits = sqliteTable(
  "rl_rate_limits",
  {
    key: text("key").primaryKey(),
    attempts: integer("attempts").notNull(),
    expiresAt: text("expiresAt").notNull(),
  },
  (t) => [index("rl_rate_expiry").on(t.expiresAt)],
);
