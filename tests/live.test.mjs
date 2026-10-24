import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { handleLiveRequest } from "../lib/live-service.ts";
import { passwordHash, passwordMatches } from "../lib/passwords.ts";
import { receivingWindow, matchEligibility } from "../lib/live-domain.ts";

let mf,
  db,
  index = 0;
const now = new Date("2027-01-10T12:00:00.000Z");
const password = "Synthetic test passphrase 2026!";
before(async () => {
  mf = new Miniflare({
    modules: true,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    script: 'export default {fetch(){return new Response("test")}}',
  });
  db = await mf.getD1Database("DB");
  const sql = await readFile(
    new URL("../drizzle/0000_wealthy_butterfly.sql", import.meta.url),
    "utf8",
  );
  for (const statement of sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
});
after(async () => {
  await mf?.dispose();
});
function client() {
  const ip = `192.0.2.${++index}`;
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    async call(input, options = {}) {
      const request = new Request(
        `http://localhost/api/live${options.thread ? `?thread=${options.thread}` : ""}`,
        {
          method: input ? "POST" : "GET",
          headers: {
            ...(input
              ? {
                  "Content-Type": "application/json",
                  Origin: options.origin || "http://localhost",
                }
              : {}),
            Cookie: cookie,
            "CF-Connecting-IP": ip,
          },
          ...(input ? { body: JSON.stringify(input) } : {}),
        },
      );
      const response = await handleLiveRequest(request, db, { now: () => now });
      const set = response.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      return {
        status: response.status,
        data: await response.json(),
        headers: response.headers,
      };
    },
  };
}
async function actor(role = "both", capacity = 100) {
  const c = client(),
    email = `fixture-${index}@rescueloop.test`;
  const signup = await c.call({
    action: "auth.signup",
    email,
    password,
    displayName: `Fixture User ${index}`,
    organizationName: `Fixture Organization ${index}`,
    area: "Test Campus",
    role,
  });
  assert.equal(signup.status, 201, JSON.stringify(signup.data));
  let w = (await c.call()).data;
  const saved = await c.call({
    action: "organization.save",
    organization: {
      ...w.organization,
      capacityKg: capacity,
      accepting: role !== "donor",
      discoverable: true,
      timezone: "UTC",
      receivingStart: "00:00",
      receivingEnd: "23:59",
    },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  w = (await c.call()).data;
  return { c, email, recoveryCode: signup.data.recoveryCode, w };
}
async function connect(a, b) {
  const request = await a.c.call({
    action: "partnership.request",
    organizationId: b.w.organization.id,
    note: "Synthetic partnership test",
  });
  assert.equal(request.status, 200, JSON.stringify(request.data));
  const accepted = await b.c.call({
    action: "partnership.respond",
    id: request.data.id,
    status: "accepted",
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
  return request.data.id;
}
async function listing(a, overrides = {}) {
  const data = {
    name: "Test vegetable rice",
    category: "Prepared meals",
    kg: 20,
    storage: "Chilled",
    diet: ["vegan"],
    allergens: "soy",
    pickupLocation: "Synthetic loading entrance",
    startAt: "2027-01-10T11:30:00.000Z",
    endAt: "2027-01-10T14:00:00.000Z",
    verified: true,
    source: "Synthetic test note",
    ...overrides,
  };
  const result = await a.c.call({ action: "listing.save", listing: data });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return (await a.c.call()).data.listings.find((f) => f.id === result.data.id);
}

test("passwords use unique salts and a slow KDF; the wrong password never matches", () => {
  const a = passwordHash(password),
    b = passwordHash(password);
  assert.notEqual(a, b);
  assert.ok(a.startsWith("scrypt$32768$8$3$"));
  assert.equal(passwordMatches(password, a), true);
  assert.equal(passwordMatches("wrong passphrase", a), false);
  assert.equal(passwordMatches(password, "malformed"), false);
});
test("registration creates a server account, private session, recovery code, and empty real workspace", async () => {
  const a = await actor();
  assert.ok(a.recoveryCode.length >= 40);
  assert.ok(a.c.cookie.includes("rescueloop_session="));
  assert.equal(a.w.listings.length, 0);
  assert.equal(a.w.pickups.length, 0);
  assert.equal(a.w.user.email, a.email);
  const serialized = JSON.stringify(a.w);
  assert.ok(!serialized.includes("passwordHash"));
  assert.ok(!serialized.includes("recoveryHash"));
  assert.ok(!serialized.includes(a.recoveryCode));
  const anonymous = await client().call();
  assert.deepEqual(anonymous.data, { user: null });
  const duplicate = await client().call({
    action: "auth.signup",
    email: a.email,
    password,
    displayName: "Duplicate",
    organizationName: "Duplicate Org",
    area: "Test Campus",
    role: "donor",
  });
  assert.equal(duplicate.status, 409);
});
test("partner acceptance, food request, messages, approval, and collection work across independent accounts", async () => {
  const donor = await actor("donor"),
    receiver = await actor("receiver");
  await connect(donor, receiver);
  const food = await listing(donor);
  const receiverState = (await receiver.c.call()).data;
  assert.ok(receiverState.listings.some((f) => f.id === food.id));
  const request = await receiver.c.call({
    action: "pickup.request",
    listingId: food.id,
  });
  assert.equal(request.status, 201, JSON.stringify(request.data));
  const donorState = (await donor.c.call()).data;
  assert.ok(
    donorState.notifications.some((n) => n.title === "New pickup request"),
  );
  const message = await receiver.c.call({
    action: "message.send",
    pickupId: request.data.id,
    body: "Synthetic arrival confirmation.",
  });
  assert.equal(message.status, 201);
  const conversation = await donor.c.call(null, { thread: request.data.id });
  assert.equal(
    conversation.data.messages[0].body,
    "Synthetic arrival confirmation.",
  );
  const approved = await donor.c.call({
    action: "pickup.approve",
    id: request.data.id,
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.data));
  let w = (await receiver.c.call()).data;
  assert.equal(w.listings.find((f) => f.id === food.id).status, "reserved");
  assert.equal(w.pickups.filter((p) => p.status === "collected").length, 0);
  const collection = await receiver.c.call({
    action: "pickup.collect",
    id: request.data.id,
  });
  assert.equal(collection.status, 200, JSON.stringify(collection.data));
  assert.match(collection.data.receipt, /^RL-/);
  w = (await donor.c.call()).data;
  assert.equal(
    w.pickups.find((p) => p.id === request.data.id).status,
    "collected",
  );
  assert.equal(w.listings.find((f) => f.id === food.id).status, "collected");
  assert.equal(
    (await receiver.c.call({ action: "pickup.collect", id: request.data.id }))
      .status,
    409,
  );
});
test("unrelated organizations cannot see private food, approve pickups, read conversations, or mark another account notifications", async () => {
  const a = await actor("donor"),
    b = await actor("receiver"),
    stranger = await actor();
  await connect(a, b);
  const f = await listing(a);
  assert.ok(
    !(await stranger.c.call()).data.listings.some((l) => l.id === f.id),
  );
  assert.notEqual(
    (await stranger.c.call({ action: "pickup.request", listingId: f.id }))
      .status,
    201,
  );
  const p = await b.c.call({ action: "pickup.request", listingId: f.id });
  assert.equal(
    (await stranger.c.call({ action: "pickup.approve", id: p.data.id })).status,
    404,
  );
  assert.equal(
    (await stranger.c.call(null, { thread: p.data.id })).status,
    404,
  );
  assert.equal(
    (await b.c.call({ action: "pickup.approve", id: p.data.id })).status,
    403,
  );
  const notification = (await a.c.call()).data.notifications.find(
    (n) => n.entityId === p.data.id,
  );
  assert.ok(notification);
  await stranger.c.call({
    action: "notifications.read",
    ids: [notification.id],
  });
  assert.equal(
    (await a.c.call()).data.notifications.find((n) => n.id === notification.id)
      .readAt,
    null,
  );
});
test("concurrent approvals for different donors cannot overbook a receiver’s daily capacity", async () => {
  const a = await actor("donor"),
    b = await actor("donor"),
    receiver = await actor("receiver", 30);
  await connect(a, receiver);
  await connect(b, receiver);
  const fa = await listing(a),
    fb = await listing(b);
  const pa = await receiver.c.call({
      action: "pickup.request",
      listingId: fa.id,
    }),
    pb = await receiver.c.call({ action: "pickup.request", listingId: fb.id });
  assert.equal(pa.status, 201);
  assert.equal(pb.status, 201);
  const results = await Promise.all([
    a.c.call({ action: "pickup.approve", id: pa.data.id }),
    b.c.call({ action: "pickup.approve", id: pb.data.id }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const w = (await receiver.c.call()).data;
  const approved = w.pickups.filter((p) => p.status === "approved");
  assert.equal(approved.length, 1);
  for (const changes of [
    { capacityKg: 10 },
    { timezone: "America/Los_Angeles" },
  ]) {
    const conflict = await receiver.c.call({
      action: "organization.save",
      organization: { ...w.organization, ...changes },
    });
    assert.equal(conflict.status, 409, JSON.stringify(conflict.data));
  }
  assert.equal(
    w.listings
      .filter((f) => f.status === "reserved")
      .reduce((n, f) => n + f.kg, 0),
    20,
  );
  const cancelled = await receiver.c.call({
    action: "pickup.cancel",
    id: approved[0].id,
  });
  assert.equal(cancelled.status, 200);
  const waiting =
    approved[0].id === pa.data.id
      ? { actor: b, id: pb.data.id }
      : { actor: a, id: pa.data.id };
  assert.equal(
    (await waiting.actor.c.call({ action: "pickup.approve", id: waiting.id }))
      .status,
    200,
  );
});
test("unverified allergens, stale listing edits, and past pickup dates are rejected", async () => {
  const a = await actor("donor"),
    b = await actor("receiver");
  await connect(a, b);
  const draft = await listing(a, { allergens: "unknown", verified: false });
  assert.ok(!(await b.c.call()).data.listings.some((f) => f.id === draft.id));
  const bad = await a.c.call({
    action: "listing.save",
    listing: { ...draft, verified: true },
  });
  assert.equal(bad.status, 400);
  const f = await listing(a);
  const request = await b.c.call({ action: "pickup.request", listingId: f.id });
  assert.equal(request.status, 201);
  assert.equal(
    (await a.c.call({ action: "listing.save", listing: { ...f, kg: 21 } }))
      .status,
    409,
  );
  const invalid = await a.c.call({
    action: "listing.save",
    listing: {
      ...f,
      id: undefined,
      endAt: "2027-01-09T12:00:00.000Z",
      startAt: "2027-01-09T11:00:00.000Z",
    },
  });
  assert.equal(invalid.status, 400);
});
test("batch imports are validated together and always stay in review", async () => {
  const a = await actor("donor");
  const template = {
    name: "Imported fixture",
    kg: 12,
    category: "Produce",
    storage: "Ambient",
    diet: ["vegan"],
    allergens: "none declared",
    pickupLocation: "Test kitchen",
    startAt: "2027-01-10T13:00:00.000Z",
    endAt: "2027-01-10T15:00:00.000Z",
    verified: true,
  };
  const invalid = await a.c.call({
    action: "listing.import",
    listings: [template, { ...template, kg: -1 }],
  });
  assert.equal(invalid.status, 400);
  assert.equal((await a.c.call()).data.listings.length, 0);
  const valid = await a.c.call({
    action: "listing.import",
    listings: [template, template],
  });
  assert.equal(valid.status, 201, JSON.stringify(valid.data));
  assert.ok(
    (await a.c.call()).data.listings.every(
      (f) => f.status === "review" && !f.verified,
    ),
  );
});
test("recovery codes are single-use and invalidate previous sessions", async () => {
  const a = await actor();
  const oldCookie = a.c.cookie;
  const recover = client();
  const reset = await recover.call({
    action: "auth.recover",
    email: a.email,
    password: "Replacement synthetic passphrase!",
    recoveryCode: a.recoveryCode,
  });
  assert.equal(reset.status, 200, JSON.stringify(reset.data));
  assert.ok(reset.data.recoveryCode);
  assert.notEqual(reset.data.recoveryCode, a.recoveryCode);
  const old = await handleLiveRequest(
    new Request("http://localhost/api/live", {
      headers: { Cookie: oldCookie },
    }),
    db,
    { now: () => now },
  );
  assert.deepEqual(await old.json(), { user: null });
  assert.equal(
    (
      await client().call({
        action: "auth.recover",
        email: a.email,
        password,
        recoveryCode: a.recoveryCode,
      })
    ).status,
    401,
  );
  assert.equal(
    (await client().call({ action: "auth.login", email: a.email, password }))
      .status,
    401,
  );
  const login = await client().call({
    action: "auth.login",
    email: a.email,
    password: "Replacement synthetic passphrase!",
  });
  assert.equal(login.status, 200);
});
test("CSRF, session expiry, logout, and notification preferences are enforced", async () => {
  const a = await actor();
  assert.equal(
    (
      await a.c.call(
        { action: "notifications.read" },
        { origin: "https://attacker.invalid" },
      )
    ).status,
    403,
  );
  const expired = await handleLiveRequest(
    new Request("http://localhost/api/live", {
      headers: { Cookie: a.c.cookie },
    }),
    db,
    { now: () => new Date(now.getTime() + 8 * 86400000) },
  );
  assert.deepEqual(await expired.json(), { user: null });
  assert.equal(
    (
      await a.c.call({
        action: "notifications.preferences",
        preferences: { partnership: false, pickup: true, message: false },
      })
    ).status,
    200,
  );
  assert.equal((await a.c.call()).data.preferences.message, false);
  assert.equal((await a.c.call({ action: "auth.logout" })).status, 200);
  assert.deepEqual((await a.c.call()).data, { user: null });
  assert.equal(
    (
      await a.c.call({
        action: "organization.save",
        organization: a.w.organization,
      })
    ).status,
    401,
  );
});
test("receiving windows honor time zones and apply capacity, storage, and diet gates", () => {
  const f = {
    id: "f",
    ownerId: "donor",
    status: "available",
    verified: true,
    kg: 20,
    category: "Prepared meals",
    storage: "Chilled",
    diet: ["vegan"],
    allergens: "soy",
    startAt: "2027-01-10T20:00:00.000Z",
    endAt: "2027-01-10T22:00:00.000Z",
  };
  const receiver = {
    id: "receiver",
    role: "receiver",
    accepting: true,
    capacityKg: 30,
    receivingStart: "12:00",
    receivingEnd: "13:00",
    timezone: "America/Los_Angeles",
    storage: ["Chilled"],
    categories: ["Prepared meals"],
    requiredDiet: "vegetarian",
    excludedAllergens: [],
  };
  assert.equal(
    receivingWindow(f, receiver, now).start,
    "2027-01-10T20:00:00.000Z",
  );
  assert.equal(
    receivingWindow(f, receiver, now).end,
    "2027-01-10T21:00:00.000Z",
  );
  assert.equal(matchEligibility(f, receiver, 0, true, now).ok, true);
  assert.equal(matchEligibility(f, receiver, 15, true, now).ok, false);
  assert.equal(
    matchEligibility(f, { ...receiver, storage: ["Ambient"] }, 0, true, now).ok,
    false,
  );
  assert.equal(
    matchEligibility(
      f,
      { ...receiver, excludedAllergens: ["soy"] },
      0,
      true,
      now,
    ).ok,
    false,
  );
});
