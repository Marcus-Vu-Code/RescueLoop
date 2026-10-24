import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { handleLiveRequest } from "../lib/live-service.ts";
import { passwordHash, passwordMatches } from "../lib/passwords.ts";
import { receivingWindow, matchEligibility } from "../lib/live-domain.ts";
import {
  mailConfiguration,
  sendMail,
  drainEmailOutbox,
  MailError,
} from "../lib/mail.ts";

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
  for (const migration of (
    await readdir(new URL("../drizzle/", import.meta.url))
  )
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      new URL("../drizzle/" + migration, import.meta.url),
      "utf8",
    );
    for (const statement of sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  }
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
      const response = await handleLiveRequest(request, db, {
        now: () => now,
        ...options.runtime,
      });
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

const mail = {
  apiKey: "synthetic-resend-key",
  from: "RescueLoop <updates@example.org>",
  origin: "https://rescueloop.test",
};
function mailbox() {
  const sent = [];
  return {
    sent,
    runtime: {
      mail,
      fetcher: async (url, init) => {
        assert.equal(url, "https://api.resend.com/emails");
        sent.push({
          body: JSON.parse(init.body),
          key: init.headers["Idempotency-Key"],
        });
        return Response.json({ id: crypto.randomUUID() });
      },
    },
  };
}
function emailToken(message, purpose) {
  return message.body.text.match(
    new RegExp(`#${purpose}=([A-Za-z0-9_-]{43})`),
  )[1];
}
async function verifyEmail(a, m) {
  const r = await a.c.call(
    { action: "account.email.verify" },
    { runtime: m.runtime },
  );
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const raw = emailToken(m.sent.at(-1), "verify");
  assert.equal(
    (
      await client().call(
        { action: "auth.email.verify", token: raw },
        { runtime: m.runtime },
      )
    ).status,
    200,
  );
  return raw;
}

test("email adapter fixes its endpoint, uses provider idempotency, and rejects invalid sender configuration", async () => {
  assert.equal(
    mailConfiguration({
      RESEND_API_KEY: "key",
      MAIL_FROM: "x@example.org\r\nBcc: victim@example.org",
      APP_ORIGIN: mail.origin,
    }),
    null,
  );
  assert.equal(
    mailConfiguration({
      RESEND_API_KEY: "key",
      MAIL_FROM: mail.from,
      APP_ORIGIN: "https://evil.example/path",
    }),
    null,
  );
  const m = mailbox();
  await sendMail(
    mail,
    "fixture@rescueloop.test",
    "Test",
    "Synthetic",
    "test-id",
    m.runtime.fetcher,
  );
  assert.equal(m.sent[0].key, "rescueloop/test-id");
  assert.ok(!JSON.stringify(m.sent).includes(mail.apiKey));
  for (const status of [403, 429, 503])
    await assert.rejects(
      () =>
        sendMail(
          mail,
          "fixture@rescueloop.test",
          "Test",
          "Synthetic",
          "test-id",
          async () => new Response("", { status }),
        ),
      (e) => e instanceof MailError && e.retryable === (status !== 403),
    );
});
test("owner-only email mode prevents all sends to other addresses", async () => {
  const values = {
    RESEND_API_KEY: "synthetic",
    MAIL_FROM: "RescueLoop <onboarding@resend.dev>",
    APP_ORIGIN: mail.origin,
  };
  assert.equal(mailConfiguration(values), null);
  const restricted = mailConfiguration({
    ...values,
    MAIL_TEST_RECIPIENT: "owner@rescueloop.test",
  });
  assert.ok(restricted);
  let called = false;
  await assert.rejects(
    () =>
      sendMail(
        restricted,
        "other@rescueloop.test",
        "Test",
        "Test",
        "owner-test",
        async () => {
          called = true;
          return Response.json({ id: "x" });
        },
      ),
    (e) => e.code === "owner_test_only",
  );
  assert.equal(called, false);
});

test("email verification requires a single-use unexpired token; email updates require separate opt-in", async () => {
  const a = await actor(),
    m = mailbox();
  assert.equal((await a.c.call()).data.user.emailVerifiedAt, null);
  assert.equal(
    (
      await a.c.call(
        { action: "account.email.preferences", enabled: true },
        { runtime: m.runtime },
      )
    ).status,
    400,
  );
  const r = await a.c.call(
    { action: "account.email.verify" },
    { runtime: m.runtime },
  );
  assert.equal(r.status, 200);
  const raw = emailToken(m.sent[0], "verify");
  await a.c.call({ action: "account.email.verify" }, { runtime: m.runtime });
  assert.equal(m.sent.length, 1, "resend cooldown prevents duplicate email");
  const saved = await db
    .prepare("SELECT hash FROM rl_email_tokens WHERE userId=?")
    .bind(a.w.user.id)
    .first();
  assert.notEqual(saved.hash, raw);
  assert.equal(
    (
      await client().call(
        { action: "auth.email.verify", token: raw },
        {
          runtime: {
            ...m.runtime,
            now: () => new Date(now.getTime() + 25 * 3600000),
          },
        },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await client().call(
        { action: "auth.email.verify", token: raw },
        { runtime: m.runtime },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await client().call(
        { action: "auth.email.verify", token: raw },
        { runtime: m.runtime },
      )
    ).status,
    400,
  );
  assert.equal((await a.c.call()).data.user.emailEnabled, false);
  assert.equal(
    (
      await a.c.call(
        { action: "account.email.preferences", enabled: true },
        { runtime: m.runtime },
      )
    ).status,
    200,
  );
  assert.equal((await a.c.call()).data.user.emailEnabled, true);
});

test("email reset hides account existence, rotates recovery, consumes the link once and revokes sessions", async () => {
  const a = await actor(),
    m = mailbox(),
    anonymous = client();
  const unknown = await anonymous.call(
    { action: "auth.email.request-reset", email: "unknown@rescueloop.test" },
    { runtime: m.runtime },
  );
  const unverified = await a.c.call(
    { action: "auth.email.request-reset", email: a.email },
    { runtime: m.runtime },
  );
  assert.deepEqual(unknown.data, unverified.data);
  assert.equal(m.sent.length, 0);
  await verifyEmail(a, m);
  const requested = await anonymous.call(
    { action: "auth.email.request-reset", email: a.email },
    { runtime: m.runtime },
  );
  assert.deepEqual(requested.data, unknown.data);
  const raw = emailToken(m.sent.at(-1), "reset");
  assert.equal(
    (
      await anonymous.call(
        {
          action: "auth.email.reset",
          token: raw,
          password: "Updated synthetic email reset passphrase!",
        },
        {
          runtime: {
            ...m.runtime,
            now: () => new Date(now.getTime() + 31 * 60000),
          },
        },
      )
    ).status,
    400,
  );
  const reset = await anonymous.call(
    {
      action: "auth.email.reset",
      token: raw,
      password: "Updated synthetic email reset passphrase!",
    },
    { runtime: m.runtime },
  );
  assert.equal(reset.status, 200, JSON.stringify(reset.data));
  assert.ok(reset.data.recoveryCode);
  assert.notEqual(reset.data.recoveryCode, a.recoveryCode);
  assert.deepEqual((await a.c.call()).data, { user: null });
  assert.deepEqual(
    (await anonymous.call()).data,
    { user: null },
    "reset never automatically signs in",
  );
  assert.equal(
    (
      await anonymous.call(
        { action: "auth.email.reset", token: raw, password },
        { runtime: m.runtime },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await anonymous.call({
        action: "auth.login",
        email: a.email,
        password: "Updated synthetic email reset passphrase!",
      })
    ).status,
    200,
  );
});
test("password changes revoke previously issued email reset links", async () => {
  const a = await actor(),
    m = mailbox();
  await verifyEmail(a, m);
  await a.c.call(
    { action: "auth.email.request-reset", email: a.email },
    { runtime: m.runtime },
  );
  const raw = emailToken(m.sent.at(-1), "reset");
  assert.equal(
    (
      await a.c.call({
        action: "account.password",
        currentPassword: password,
        newPassword: "Synthetic changed password after issuing email!",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await client().call(
        { action: "auth.email.reset", token: raw, password },
        { runtime: m.runtime },
      )
    ).status,
    400,
  );
});
test("reset responses can return before provider delivery without exposing account existence", async () => {
  const a = await actor(),
    m = mailbox();
  await verifyEmail(a, m);
  const tasks = [];
  const runtime = { ...m.runtime, defer: (task) => tasks.push(task) };
  const response = await client().call(
    { action: "auth.email.request-reset", email: a.email },
    { runtime },
  );
  assert.equal(response.status, 200);
  await Promise.all(tasks);
  assert.equal(m.sent.length, 2);
});

async function notification(a, title = "Synthetic notification") {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO rl_notifications(id,userId,eventKey,kind,title,body,entityId,createdAt) VALUES(?,?,?,'pickup',?,'Synthetic',?,?)",
    )
    .bind(id, a.w.user.id, id, title, crypto.randomUUID(), now.toISOString())
    .run();
  return id;
}
test("transactional notification outbox sends once under concurrent workers and honors opt-out", async () => {
  const a = await actor(),
    m = mailbox();
  await notification(a);
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) AS n FROM rl_email_outbox WHERE userId=?")
        .bind(a.w.user.id)
        .first()
    ).n,
    0,
  );
  await verifyEmail(a, m);
  await a.c.call(
    { action: "account.email.preferences", enabled: true },
    { runtime: m.runtime },
  );
  m.sent.length = 0;
  const id = await notification(a);
  await Promise.all([
    drainEmailOutbox(db, mail, now, m.runtime.fetcher),
    drainEmailOutbox(db, mail, now, m.runtime.fetcher),
  ]);
  assert.equal(
    m.sent.filter((s) => s.key === `rescueloop/notification/${id}`).length,
    1,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT status FROM rl_email_outbox WHERE id=?")
        .bind(id)
        .first()
    ).status,
    "sent",
  );
  const cancelled = await notification(a);
  await a.c.call(
    { action: "account.email.preferences", enabled: false },
    { runtime: m.runtime },
  );
  await drainEmailOutbox(db, mail, now, m.runtime.fetcher);
  assert.equal(
    (
      await db
        .prepare("SELECT status FROM rl_email_outbox WHERE id=?")
        .bind(cancelled)
        .first()
    ).status,
    "cancelled",
  );
  assert.ok(
    !m.sent.some((s) => s.key === `rescueloop/notification/${cancelled}`),
  );
});
test("email retries keep the same idempotency key, respect backoff and discard permanent failures", async () => {
  const a = await actor(),
    m = mailbox();
  await verifyEmail(a, m);
  await a.c.call(
    { action: "account.email.preferences", enabled: true },
    { runtime: m.runtime },
  );
  m.sent.length = 0;
  const id = await notification(a);
  await drainEmailOutbox(
    db,
    mail,
    now,
    async () => new Response("", { status: 503 }),
  );
  let q = await db
    .prepare("SELECT * FROM rl_email_outbox WHERE id=?")
    .bind(id)
    .first();
  assert.equal(q.status, "pending");
  assert.equal(q.attempts, 1);
  await drainEmailOutbox(db, mail, now, m.runtime.fetcher);
  assert.equal(m.sent.length, 0);
  await drainEmailOutbox(
    db,
    mail,
    new Date(now.getTime() + 61000),
    m.runtime.fetcher,
  );
  assert.equal(m.sent[0].key, `rescueloop/notification/${id}`);
  const bad = await notification(a);
  await drainEmailOutbox(
    db,
    mail,
    now,
    async () => new Response("", { status: 403 }),
  );
  q = await db
    .prepare("SELECT * FROM rl_email_outbox WHERE id=?")
    .bind(bad)
    .first();
  assert.equal(q.status, "failed");
  assert.equal(q.lastError, "provider_403");
});
