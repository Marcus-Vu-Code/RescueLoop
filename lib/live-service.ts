import { z } from "zod";
import {
  organizationSchema,
  listingSchema,
  preferencesSchema,
  matchEligibility,
  canDonate,
  localParts,
  type Organization,
  type Listing,
  type Pickup,
  type Partnership,
  type User,
  type Preferences,
} from "./live-domain.ts";
import {
  passwordHash,
  passwordMatches,
  token,
  digest,
  equalDigest,
  DUMMY_PASSWORD_HASH,
} from "./passwords.ts";

type Account = User & {
  passwordHash: string;
  recoveryHash: string;
  preferences: string;
};
type Row = Record<string, unknown>;
type Runtime = { providerConfigured?: boolean; now?: () => Date };
export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
function fail(status: number, message: string): never {
  throw new AppError(status, message);
}
const idSchema = z.string().uuid();
const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z
    .string()
    .min(15, "Use a passphrase of at least 15 characters.")
    .max(128),
});
const signup = credentials.extend({
  displayName: z.string().trim().min(2).max(80),
  organizationName: z.string().trim().min(2).max(140),
  area: z.string().trim().min(2).max(160),
  role: z.enum(["donor", "receiver", "both"]),
});
const json = (data: unknown, status = 200, cookie?: string) => {
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
  };
  if (cookie) headers["Set-Cookie"] = cookie;
  return Response.json(data, { status, headers });
};
const org = (r: Row): Organization =>
  ({
    ...r,
    accepting: !!r.accepting,
    discoverable: !!r.discoverable,
    storage: JSON.parse(String(r.storage)),
    categories: JSON.parse(String(r.categories)),
    excludedAllergens: JSON.parse(String(r.excludedAllergens)),
  }) as Organization;
const food = (r: Row): Listing =>
  ({
    ...r,
    verified: !!r.verified,
    diet: JSON.parse(String(r.diet)),
  }) as Listing;
const publicUser = (a: Account): User => ({
  id: a.id,
  email: a.email,
  displayName: a.displayName,
  createdAt: a.createdAt,
});
const cookieName = (r: Request) =>
  new URL(r.url).protocol === "https:"
    ? "__Host-rescueloop_session"
    : "rescueloop_session";
function sessionCookie(r: Request, value: string, age = 604800) {
  return `${cookieName(r)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(r.url).protocol === "https:" ? "; Secure" : ""}`;
}
function sessionValue(r: Request) {
  return (
    (r.headers.get("cookie") || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName(r) + "="))
      ?.slice(cookieName(r).length + 1) || ""
  );
}
export async function accountForRequest(
  r: Request,
  db: D1Database,
  now = new Date(),
): Promise<Account | null> {
  const value = sessionValue(r);
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  return db
    .prepare(
      "SELECT a.* FROM rl_accounts a JOIN rl_sessions s ON s.userId=a.id WHERE s.hash=? AND s.expiresAt>?",
    )
    .bind(digest(value), now.toISOString())
    .first<Account>();
}
function sessionStatement(
  db: D1Database,
  userId: string,
  value: string,
  now: Date,
) {
  return db
    .prepare(
      "INSERT INTO rl_sessions(hash,userId,expiresAt,createdAt) VALUES(?,?,?,?)",
    )
    .bind(
      digest(value),
      userId,
      new Date(now.getTime() + 604800000).toISOString(),
      now.toISOString(),
    );
}
async function rows<T>(
  db: D1Database,
  query: string,
  ...values: (string | number | null)[]
): Promise<T[]> {
  return (
    await db
      .prepare(query)
      .bind(...values)
      .all<T>()
  ).results;
}
async function myOrg(db: D1Database, userId: string) {
  const row = await db
    .prepare("SELECT * FROM rl_organizations WHERE ownerId=?")
    .bind(userId)
    .first<Row>();
  if (!row)
    fail(
      409,
      "Your organization profile is missing. Contact the workspace owner.",
    );
  return org(row!);
}
async function getFood(db: D1Database, id: string) {
  const r = await db
    .prepare("SELECT * FROM rl_listings WHERE id=?")
    .bind(id)
    .first<Row>();
  if (!r) fail(404, "Listing not found.");
  return food(r!);
}
async function getOrg(db: D1Database, id: string) {
  const r = await db
    .prepare("SELECT * FROM rl_organizations WHERE id=?")
    .bind(id)
    .first<Row>();
  if (!r) fail(404, "Organization not found.");
  return org(r!);
}
async function connected(db: D1Database, a: string, b: string) {
  return !!(await db
    .prepare(
      "SELECT id FROM rl_partnerships WHERE status='accepted' AND ((orgA=? AND orgB=?) OR (orgA=? AND orgB=?))",
    )
    .bind(a, b, b, a)
    .first());
}
async function capacityUsed(db: D1Database, receiverId: string, day: string) {
  const r = await db
    .prepare(
      "SELECT COALESCE(SUM(l.kg),0) AS kg FROM rl_pickups p JOIN rl_listings l ON l.id=p.listingId WHERE p.receiverId=? AND p.serviceDay=? AND p.status IN ('approved','collected')",
    )
    .bind(receiverId, day)
    .first<{ kg: number }>();
  return r?.kg || 0;
}
function notice(
  db: D1Database,
  organizationId: string,
  kind: "partnership" | "pickup" | "message",
  key: string,
  title: string,
  body: string,
  entityId: string,
  now: string,
  guard = "1",
  guardValues: (string | number)[] = [],
) {
  return db
    .prepare(
      `INSERT OR IGNORE INTO rl_notifications(id,userId,eventKey,kind,title,body,entityId,createdAt) SELECT ?,o.ownerId,?,?,?,?,?,? FROM rl_organizations o JOIN rl_accounts a ON a.id=o.ownerId WHERE o.id=? AND COALESCE(json_extract(a.preferences,'$.${kind}'),1)=1 AND (${guard})`,
    )
    .bind(
      crypto.randomUUID(),
      key,
      kind,
      title,
      body,
      entityId,
      now,
      organizationId,
      ...guardValues,
    );
}
async function throttle(
  db: D1Database,
  r: Request,
  scope: string,
  identity: string,
  max: number,
  now: Date,
  windowSeconds = 900,
) {
  const bucket = Math.floor(now.getTime() / (windowSeconds * 1000));
  const ip = r.headers.get("cf-connecting-ip") || "local";
  const key = digest(`${scope}|${identity}|${ip}|${bucket}`);
  const result = await db
    .prepare(
      "INSERT INTO rl_rate_limits(key,attempts,expiresAt) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
    )
    .bind(key, new Date((bucket + 1) * windowSeconds * 1000).toISOString())
    .first<{ attempts: number }>();
  if ((result?.attempts || 0) > max)
    fail(429, "Too many attempts. Please wait before trying again.");
}
async function readBody(r: Request) {
  if (
    !r.headers.get("content-type")?.toLowerCase().startsWith("application/json")
  )
    fail(415, "Send JSON from the RescueLoop application.");
  const reader = r.body?.getReader();
  if (!reader) fail(400, "Request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    size += value.byteLength;
    if (size > 30000) {
      await reader!.cancel();
      fail(413, "This request is too large.");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    data.set(c, offset);
    offset += c.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(data)) as Record<
      string,
      unknown
    >;
  } catch {
    fail(400, "Invalid JSON.");
  }
}

export async function handleLiveRequest(
  request: Request,
  db: D1Database,
  runtime: Runtime = {},
): Promise<Response> {
  const now = runtime.now?.() || new Date(),
    stamp = now.toISOString();
  try {
    if (request.method === "GET") {
      const account = await accountForRequest(request, db, now);
      if (!account) return json({ user: null });
      const me = await myOrg(db, account.id);
      const thread = new URL(request.url).searchParams.get("thread");
      if (thread) {
        idSchema.parse(thread);
        const p = await db
          .prepare(
            "SELECT * FROM rl_pickups WHERE id=? AND (donorId=? OR receiverId=?)",
          )
          .bind(thread, me.id, me.id)
          .first<Pickup>();
        if (!p) fail(404, "Pickup conversation not found.");
        const messages = await rows(
          db,
          "SELECT * FROM (SELECT * FROM rl_messages WHERE pickupId=? ORDER BY createdAt DESC LIMIT 100) ORDER BY createdAt",
          thread,
        );
        return json({ messages });
      }
      const [directory, partnerships, listingRows, pickups, notifications] =
        await Promise.all([
          rows<Row>(
            db,
            `SELECT * FROM rl_organizations o WHERE o.id<>? AND (o.discoverable=1 OR o.id IN (SELECT CASE WHEN orgA=? THEN orgB ELSE orgA END FROM rl_partnerships WHERE orgA=? OR orgB=?)) ORDER BY o.name LIMIT 200`,
            me.id,
            me.id,
            me.id,
            me.id,
          ),
          rows<Partnership>(
            db,
            "SELECT * FROM rl_partnerships WHERE orgA=? OR orgB=? ORDER BY updatedAt DESC LIMIT 500",
            me.id,
            me.id,
          ),
          rows<Row>(
            db,
            `SELECT * FROM rl_listings l WHERE l.ownerId=? OR l.id IN (SELECT listingId FROM rl_pickups WHERE donorId=? OR receiverId=?) OR (l.status='available' AND l.endAt>? AND l.ownerId IN (SELECT CASE WHEN orgA=? THEN orgB ELSE orgA END FROM rl_partnerships WHERE status='accepted' AND (orgA=? OR orgB=?))) ORDER BY l.endAt DESC LIMIT 1000`,
            me.id,
            me.id,
            me.id,
            stamp,
            me.id,
            me.id,
            me.id,
          ),
          rows<Pickup>(
            db,
            "SELECT * FROM rl_pickups WHERE donorId=? OR receiverId=? ORDER BY updatedAt DESC LIMIT 1000",
            me.id,
            me.id,
          ),
          rows(
            db,
            "SELECT id,userId,kind,title,body,entityId,readAt,createdAt FROM rl_notifications WHERE userId=? ORDER BY createdAt DESC LIMIT 100",
            account.id,
          ),
        ]);
      return json({
        user: publicUser(account),
        organization: me,
        directory: directory.map(org),
        partnerships,
        listings: listingRows
          .map(food)
          .map((f) => (f.ownerId === me.id ? f : { ...f, source: "" })),
        pickups,
        notifications,
        preferences: JSON.parse(account.preferences) as Preferences,
        serverTime: stamp,
        providerConfigured: !!runtime.providerConfigured,
      });
    }
    if (request.method !== "POST")
      return json({ error: "Method not allowed." }, 405);
    if (request.headers.get("origin") !== new URL(request.url).origin)
      fail(403, "Submit changes from this RescueLoop site.");
    const input = await readBody(request);
    const action = z.string().max(60).parse(input?.action);
    if (action === "auth.signup") {
      await throttle(db, request, "signup", "", 5, now, 3600);
      const data = signup.parse(input);
      const userId = crypto.randomUUID(),
        orgId = crypto.randomUUID(),
        session = token(),
        recoveryCode = token();
      const hash = passwordHash(data.password);
      try {
        await db.batch([
          db
            .prepare(
              "INSERT INTO rl_accounts(id,email,displayName,passwordHash,recoveryHash,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)",
            )
            .bind(
              userId,
              data.email,
              data.displayName,
              hash,
              digest(recoveryCode),
              stamp,
              stamp,
            ),
          db
            .prepare(
              "INSERT INTO rl_organizations(id,ownerId,name,role,area,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)",
            )
            .bind(
              orgId,
              userId,
              data.organizationName,
              data.role,
              data.area,
              stamp,
              stamp,
            ),
          sessionStatement(db, userId, session, now),
        ]);
      } catch (error) {
        if (String(error).includes("UNIQUE"))
          fail(
            409,
            "An account with this email already exists. Sign in or use your recovery code.",
          );
        throw error;
      }
      return json(
        { ok: true, recoveryCode },
        201,
        sessionCookie(request, session),
      );
    }
    if (action === "auth.login") {
      const data = credentials.parse(input);
      await throttle(db, request, "login", data.email, 10, now);
      await throttle(db, request, "login-ip", "", 60, now);
      const account = await db
        .prepare("SELECT * FROM rl_accounts WHERE email=?")
        .bind(data.email)
        .first<Account>();
      const valid = passwordMatches(
        data.password,
        account?.passwordHash || DUMMY_PASSWORD_HASH,
      );
      if (!account || !valid) fail(401, "Email or password is incorrect.");
      const session = token();
      await db.batch([
        db.prepare("DELETE FROM rl_sessions WHERE expiresAt<=?").bind(stamp),
        sessionStatement(db, account.id, session, now),
      ]);
      return json({ ok: true }, 200, sessionCookie(request, session));
    }
    if (action === "auth.recover") {
      const data = credentials
        .extend({ recoveryCode: z.string().min(20).max(100) })
        .parse(input);
      await throttle(db, request, "recover", data.email, 5, now, 3600);
      const account = await db
        .prepare("SELECT * FROM rl_accounts WHERE email=?")
        .bind(data.email)
        .first<Account>();
      if (
        !account ||
        !equalDigest(account.recoveryHash, digest(data.recoveryCode))
      )
        fail(401, "Email or recovery code is incorrect.");
      const recoveryCode = token(),
        session = token();
      const hash = passwordHash(data.password);
      const result = await db.batch([
        db
          .prepare(
            "UPDATE rl_accounts SET passwordHash=?,recoveryHash=?,updatedAt=? WHERE id=? AND recoveryHash=?",
          )
          .bind(
            hash,
            digest(recoveryCode),
            stamp,
            account.id,
            account.recoveryHash,
          ),
        db
          .prepare(
            "DELETE FROM rl_sessions WHERE userId=? AND EXISTS(SELECT 1 FROM rl_accounts WHERE id=? AND recoveryHash=?)",
          )
          .bind(account.id, account.id, digest(recoveryCode)),
        db
          .prepare(
            "INSERT INTO rl_sessions(hash,userId,expiresAt,createdAt) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM rl_accounts WHERE id=? AND recoveryHash=?)",
          )
          .bind(
            digest(session),
            account.id,
            new Date(now.getTime() + 604800000).toISOString(),
            stamp,
            account.id,
            digest(recoveryCode),
          ),
      ]);
      if (!result[0].meta.changes)
        fail(409, "This recovery code was already used.");
      return json(
        { ok: true, recoveryCode },
        200,
        sessionCookie(request, session),
      );
    }
    const account = await accountForRequest(request, db, now);
    if (!account) fail(401, "Your session has ended. Please sign in.");
    if (action === "auth.logout") {
      await db
        .prepare("DELETE FROM rl_sessions WHERE hash=?")
        .bind(digest(sessionValue(request)))
        .run();
      return json({ ok: true }, 200, sessionCookie(request, "", 0));
    }
    const me = await myOrg(db, account!.id);
    await throttle(db, request, "write", account!.id, 180, now, 60);
    if (action === "account.password") {
      const data = z
        .object({
          currentPassword: z.string().max(128),
          newPassword: z.string().min(15).max(128),
        })
        .parse(input);
      await throttle(db, request, "password", account!.id, 8, now);
      if (!passwordMatches(data.currentPassword, account!.passwordHash))
        fail(401, "Current password is incorrect.");
      const session = token(),
        hash = passwordHash(data.newPassword);
      const result = await db.batch([
        db
          .prepare(
            "UPDATE rl_accounts SET passwordHash=?,updatedAt=? WHERE id=? AND passwordHash=?",
          )
          .bind(hash, stamp, account!.id, account!.passwordHash),
        db
          .prepare(
            "DELETE FROM rl_sessions WHERE userId=? AND EXISTS(SELECT 1 FROM rl_accounts WHERE id=? AND passwordHash=?)",
          )
          .bind(account!.id, account!.id, hash),
        db
          .prepare(
            "INSERT INTO rl_sessions(hash,userId,expiresAt,createdAt) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM rl_accounts WHERE id=? AND passwordHash=?)",
          )
          .bind(
            digest(session),
            account!.id,
            new Date(now.getTime() + 604800000).toISOString(),
            stamp,
            account!.id,
            hash,
          ),
      ]);
      if (!result[0].meta.changes) fail(409, "Account changed. Sign in again.");
      return json({ ok: true }, 200, sessionCookie(request, session));
    }
    if (action === "account.recovery") {
      const password = z.string().max(128).parse(input.password);
      await throttle(db, request, "recovery-rotate", account!.id, 8, now);
      if (!passwordMatches(password, account!.passwordHash))
        fail(401, "Current password is incorrect.");
      const recoveryCode = token();
      await db
        .prepare("UPDATE rl_accounts SET recoveryHash=?,updatedAt=? WHERE id=?")
        .bind(digest(recoveryCode), stamp, account!.id)
        .run();
      return json({ ok: true, recoveryCode });
    }
    if (action === "notifications.preferences") {
      const preferences = preferencesSchema.parse(input.preferences);
      await db
        .prepare("UPDATE rl_accounts SET preferences=?,updatedAt=? WHERE id=?")
        .bind(JSON.stringify(preferences), stamp, account!.id)
        .run();
      return json({ ok: true });
    }
    if (action === "notifications.read") {
      const ids = z
        .array(z.string().min(16).max(64))
        .max(100)
        .optional()
        .parse(input.ids);
      if (ids?.length)
        await db.batch(
          ids.map((id) =>
            db
              .prepare(
                "UPDATE rl_notifications SET readAt=? WHERE id=? AND userId=? AND readAt IS NULL",
              )
              .bind(stamp, id, account!.id),
          ),
        );
      else if (!ids)
        await db
          .prepare(
            "UPDATE rl_notifications SET readAt=? WHERE userId=? AND readAt IS NULL",
          )
          .bind(stamp, account!.id)
          .run();
      return json({ ok: true });
    }
    if (action === "organization.save") {
      const data = organizationSchema.parse(input.organization);
      const day = [
        localParts(stamp, data.timezone).date,
        localParts(stamp, me.timezone).date,
      ].sort()[0];
      const result = await db
        .prepare(
          `UPDATE rl_organizations SET name=?,role=?,description=?,area=?,timezone=?,capacityKg=?,accepting=?,receivingStart=?,receivingEnd=?,storage=?,categories=?,requiredDiet=?,excludedAllergens=?,discoverable=?,version=version+1,updatedAt=? WHERE id=? AND ownerId=? AND version=? AND ? >= (SELECT COALESCE(MAX(total),0) FROM (SELECT SUM(l.kg) AS total FROM rl_pickups p JOIN rl_listings l ON l.id=p.listingId WHERE p.receiverId=? AND p.serviceDay>=? AND p.status IN ('approved','collected') GROUP BY p.serviceDay)) AND (timezone=? OR NOT EXISTS(SELECT 1 FROM rl_pickups p WHERE p.receiverId=? AND (p.status='approved' OR (p.status='collected' AND p.serviceDay>=?))))`,
        )
        .bind(
          data.name,
          data.role,
          data.description,
          data.area,
          data.timezone,
          data.capacityKg,
          +data.accepting,
          data.receivingStart,
          data.receivingEnd,
          JSON.stringify(data.storage),
          JSON.stringify(data.categories),
          data.requiredDiet,
          JSON.stringify(data.excludedAllergens),
          +data.discoverable,
          stamp,
          me.id,
          account!.id,
          data.version,
          data.capacityKg,
          me.id,
          day,
          data.timezone,
          me.id,
          day,
        )
        .run();
      if (!result.meta.changes)
        fail(
          409,
          "Profile changed, capacity is below existing reservations, or a time-zone change conflicts with active pickups. Refresh and review your pickups.",
        );
      return json({ ok: true });
    }
    if (action === "partnership.request") {
      const targetId = idSchema.parse(input.organizationId),
        note = z.string().trim().max(500).default("").parse(input.note);
      if (targetId === me.id) fail(400, "Choose another organization.");
      const target = await getOrg(db, targetId);
      if (!target.discoverable)
        fail(404, "This organization is not accepting directory connections.");
      const [a, b] = [me.id, targetId].sort();
      const previous = await db
        .prepare("SELECT * FROM rl_partnerships WHERE orgA=? AND orgB=?")
        .bind(a, b)
        .first<Partnership>();
      if (previous && ["pending", "accepted"].includes(previous.status))
        fail(409, "A partnership or pending request already exists.");
      const id = previous?.id || crypto.randomUUID();
      const guard =
        "EXISTS(SELECT 1 FROM rl_partnerships WHERE id=? AND status='pending' AND requesterId=?)";
      const key = `partnership:${id}:request:${stamp}`;
      const result = await db.batch([
        previous
          ? db
              .prepare(
                "UPDATE rl_partnerships SET status='pending',requesterId=?,note=?,updatedAt=? WHERE id=? AND status IN ('declined','ended')",
              )
              .bind(me.id, note, stamp, id)
          : db
              .prepare(
                "INSERT INTO rl_partnerships(id,orgA,orgB,requesterId,status,note,createdAt,updatedAt) VALUES(?,?,?,?,'pending',?,?,?)",
              )
              .bind(id, a, b, me.id, note, stamp, stamp),
        notice(
          db,
          targetId,
          "partnership",
          key,
          "New partner request",
          `${me.name} would like to partner with your organization.`,
          id,
          stamp,
          guard,
          [id, me.id],
        ),
      ]);
      if (!result[0].meta.changes)
        fail(409, "The partnership request changed. Refresh and try again.");
      return json({ ok: true, id });
    }
    if (action === "partnership.respond" || action === "partnership.end") {
      const id = idSchema.parse(input.id);
      const p = await db
        .prepare(
          "SELECT * FROM rl_partnerships WHERE id=? AND (orgA=? OR orgB=?)",
        )
        .bind(id, me.id, me.id)
        .first<Partnership>();
      if (!p) fail(404, "Partnership not found.");
      let status: string;
      if (action === "partnership.respond") {
        if (p!.status !== "pending" || p!.requesterId === me.id)
          fail(
            403,
            "Only the receiving organization can respond to a pending request.",
          );
        status = z.enum(["accepted", "declined"]).parse(input.status);
      } else {
        if (!["pending", "accepted"].includes(p!.status))
          fail(409, "This partnership is already closed.");
        status = "ended";
      }
      const other = p!.orgA === me.id ? p!.orgB : p!.orgA;
      await db.batch([
        db
          .prepare(
            "UPDATE rl_partnerships SET status=?,updatedAt=? WHERE id=? AND status=?",
          )
          .bind(status, stamp, id, p!.status),
        notice(
          db,
          other,
          "partnership",
          `partnership:${id}:${status}:${stamp}`,
          status === "accepted"
            ? "Partnership accepted"
            : "Partnership updated",
          `${me.name} ${status === "accepted" ? "accepted your partnership request." : status === "declined" ? "declined the partnership request." : "closed the partnership. Existing approved pickups remain accessible."}`,
          id,
          stamp,
          "EXISTS(SELECT 1 FROM rl_partnerships WHERE id=? AND status=?)",
          [id, status],
        ),
      ]);
      return json({ ok: true });
    }
    if (action === "listing.import") {
      if (!canDonate(me))
        fail(403, "Only donor organizations can import surplus.");
      const entries = z
        .array(listingSchema)
        .min(1)
        .max(30)
        .parse(input.listings);
      if (
        entries.some(
          (f) =>
            Date.parse(f.endAt) <= now.getTime() ||
            Date.parse(f.startAt) > now.getTime() + 30 * 86400000,
        )
      )
        fail(
          400,
          "Every pickup must end in the future and start within 30 days.",
        );
      const statements = entries.map((data) =>
        db
          .prepare(
            "INSERT INTO rl_listings(id,ownerId,name,category,kg,storage,diet,allergens,pickupLocation,startAt,endAt,verified,status,source,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,'review',?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            me.id,
            data.name,
            data.category,
            data.kg,
            data.storage,
            JSON.stringify(data.diet),
            data.allergens,
            data.pickupLocation,
            data.startAt,
            data.endAt,
            data.source,
            stamp,
            stamp,
          ),
      );
      await db.batch(statements);
      return json({ ok: true, count: entries.length }, 201);
    }
    if (action === "listing.save") {
      if (!canDonate(me))
        fail(
          403,
          "Set your organization role to donor or both to list surplus.",
        );
      const data = listingSchema.parse(input.listing);
      if (Date.parse(data.endAt) <= now.getTime())
        fail(400, "Pickup end must be in the future.");
      if (Date.parse(data.startAt) > now.getTime() + 30 * 86400000)
        fail(400, "List pickups up to 30 days ahead.");
      const status = data.verified ? "available" : "review";
      if (data.id) {
        if (!data.version) fail(400, "Listing version is required.");
        const result = await db
          .prepare(
            `UPDATE rl_listings SET name=?,category=?,kg=?,storage=?,diet=?,allergens=?,pickupLocation=?,startAt=?,endAt=?,verified=?,status=?,source=?,version=version+1,updatedAt=? WHERE id=? AND ownerId=? AND version=? AND status IN ('available','review') AND NOT EXISTS(SELECT 1 FROM rl_pickups WHERE listingId=? AND status IN ('requested','approved'))`,
          )
          .bind(
            data.name,
            data.category,
            data.kg,
            data.storage,
            JSON.stringify(data.diet),
            data.allergens,
            data.pickupLocation,
            data.startAt,
            data.endAt,
            +data.verified,
            status,
            data.source,
            stamp,
            data.id,
            me.id,
            data.version,
            data.id,
          )
          .run();
        if (!result.meta.changes)
          fail(
            409,
            "This listing changed or has an active pickup request. Resolve requests before editing.",
          );
        return json({ ok: true, id: data.id });
      }
      const id = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO rl_listings(id,ownerId,name,category,kg,storage,diet,allergens,pickupLocation,startAt,endAt,verified,status,source,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          me.id,
          data.name,
          data.category,
          data.kg,
          data.storage,
          JSON.stringify(data.diet),
          data.allergens,
          data.pickupLocation,
          data.startAt,
          data.endAt,
          +data.verified,
          status,
          data.source,
          stamp,
          stamp,
        )
        .run();
      return json({ ok: true, id }, 201);
    }
    if (action === "listing.withdraw") {
      const id = idSchema.parse(input.id);
      const result = await db.batch([
        db
          .prepare(
            "UPDATE rl_listings SET status='withdrawn',version=version+1,updatedAt=? WHERE id=? AND ownerId=? AND status IN ('available','review')",
          )
          .bind(stamp, id, me.id),
        db
          .prepare(
            "UPDATE rl_pickups SET status='declined',updatedAt=? WHERE listingId=? AND status='requested' AND EXISTS(SELECT 1 FROM rl_listings WHERE id=? AND ownerId=? AND status='withdrawn')",
          )
          .bind(stamp, id, id, me.id),
        db
          .prepare(
            `INSERT OR IGNORE INTO rl_notifications(id,userId,eventKey,kind,title,body,entityId,createdAt) SELECT lower(hex(randomblob(16))),o.ownerId,'withdrawn:'||p.id,'pickup','Listing withdrawn','The donor withdrew this listing.',p.id,? FROM rl_pickups p JOIN rl_organizations o ON o.id=p.receiverId WHERE p.listingId=? AND p.status='declined' AND p.updatedAt=? AND p.donorId=?`,
          )
          .bind(stamp, id, stamp, me.id),
      ]);
      if (!result[0].meta.changes)
        fail(409, "Only your unreserved listings can be withdrawn.");
      return json({ ok: true });
    }
    if (action === "pickup.request") {
      const listing = await getFood(db, idSchema.parse(input.listingId));
      const check = matchEligibility(
        listing,
        me,
        0,
        await connected(db, me.id, listing.ownerId),
        now,
      );
      if (check.window) {
        const used = await capacityUsed(db, me.id, check.window.day);
        if (used + listing.kg > me.capacityKg)
          check.blocked.push("Not enough remaining receiving capacity.");
      }
      if (check.blocked.length) fail(409, check.blocked.join(" "));
      const w = check.window!;
      const id = crypto.randomUUID();
      try {
        const result = await db.batch([
          db
            .prepare(
              `INSERT INTO rl_pickups(id,listingId,donorId,receiverId,status,serviceDay,windowStart,windowEnd,createdAt,updatedAt) SELECT ?,?,?,?,'requested',?,?,?,?,? WHERE EXISTS(SELECT 1 FROM rl_listings WHERE id=? AND status='available' AND version=? AND endAt>?) AND EXISTS(SELECT 1 FROM rl_partnerships WHERE status='accepted' AND ((orgA=? AND orgB=?) OR (orgA=? AND orgB=?)))`,
            )
            .bind(
              id,
              listing.id,
              listing.ownerId,
              me.id,
              w.day,
              w.start,
              w.end,
              stamp,
              stamp,
              listing.id,
              listing.version,
              stamp,
              me.id,
              listing.ownerId,
              listing.ownerId,
              me.id,
            ),
          notice(
            db,
            listing.ownerId,
            "pickup",
            `pickup:${id}:request`,
            "New pickup request",
            `${me.name} requested ${listing.name}.`,
            id,
            stamp,
            "EXISTS(SELECT 1 FROM rl_pickups WHERE id=?)",
            [id],
          ),
        ]);
        if (!result[0].meta.changes)
          fail(
            409,
            "The listing or partnership changed. Refresh before requesting.",
          );
      } catch (error) {
        if (String(error).includes("UNIQUE"))
          fail(409, "You already have an active request for this listing.");
        throw error;
      }
      return json({ ok: true, id }, 201);
    }
    if (action.startsWith("pickup.")) {
      const id = idSchema.parse(input.id);
      const p = await db
        .prepare(
          "SELECT * FROM rl_pickups WHERE id=? AND (donorId=? OR receiverId=?)",
        )
        .bind(id, me.id, me.id)
        .first<Pickup>();
      if (!p) fail(404, "Pickup not found.");
      const listing = await getFood(db, p!.listingId);
      const counterpart = me.id === p!.donorId ? p!.receiverId : p!.donorId;
      if (action === "pickup.approve") {
        if (me.id !== p!.donorId)
          fail(403, "Only the donor can approve a pickup.");
        if (p!.status !== "requested")
          fail(409, "This request is no longer awaiting approval.");
        const receiver = await getOrg(db, p!.receiverId);
        const check = matchEligibility(
          listing,
          receiver,
          0,
          await connected(db, me.id, receiver.id),
          now,
        );
        if (check.window) {
          const used = await capacityUsed(db, receiver.id, check.window.day);
          if (used + listing.kg > receiver.capacityKg)
            check.blocked.push("Not enough remaining receiving capacity.");
        }
        if (check.blocked.length) fail(409, check.blocked.join(" "));
        const w = check.window!;
        // D1 executes this batch as one transaction. The first conditional write
        // serializes both listing assignment and receiver-day capacity checks.
        const result = await db.batch([
          db
            .prepare(
              `UPDATE rl_listings SET status='reserved',assignedPickupId=?,version=version+1,updatedAt=? WHERE id=? AND ownerId=? AND status='available' AND version=? AND endAt>? AND EXISTS(SELECT 1 FROM rl_pickups WHERE id=? AND status='requested') AND EXISTS(SELECT 1 FROM rl_organizations WHERE id=? AND version=? AND accepting=1) AND EXISTS(SELECT 1 FROM rl_partnerships WHERE status='accepted' AND ((orgA=? AND orgB=?) OR (orgA=? AND orgB=?))) AND kg+COALESCE((SELECT SUM(l.kg) FROM rl_pickups p JOIN rl_listings l ON l.id=p.listingId WHERE p.receiverId=? AND p.serviceDay=? AND p.status IN ('approved','collected')),0)<=(SELECT capacityKg FROM rl_organizations WHERE id=?)`,
            )
            .bind(
              id,
              stamp,
              listing.id,
              me.id,
              listing.version,
              stamp,
              id,
              receiver.id,
              receiver.version,
              me.id,
              receiver.id,
              receiver.id,
              me.id,
              receiver.id,
              w.day,
              receiver.id,
            ),
          db
            .prepare(
              "UPDATE rl_pickups SET status='approved',serviceDay=?,windowStart=?,windowEnd=?,updatedAt=? WHERE id=? AND status='requested' AND EXISTS(SELECT 1 FROM rl_listings WHERE id=? AND status='reserved' AND assignedPickupId=?)",
            )
            .bind(w.day, w.start, w.end, stamp, id, listing.id, id),
          db
            .prepare(
              "UPDATE rl_pickups SET status='declined',updatedAt=? WHERE listingId=? AND id<>? AND status='requested' AND EXISTS(SELECT 1 FROM rl_listings WHERE id=? AND assignedPickupId=?)",
            )
            .bind(stamp, listing.id, id, listing.id, id),
          notice(
            db,
            receiver.id,
            "pickup",
            `pickup:${id}:approved`,
            "Pickup approved",
            `${me.name} approved your pickup of ${listing.name}.`,
            id,
            stamp,
            "EXISTS(SELECT 1 FROM rl_pickups WHERE id=? AND status='approved')",
            [id],
          ),
          db
            .prepare(
              `INSERT OR IGNORE INTO rl_notifications(id,userId,eventKey,kind,title,body,entityId,createdAt) SELECT lower(hex(randomblob(16))),o.ownerId,'assigned-other:'||p.id,'pickup','Pickup request declined','Another partner was assigned this food.',p.id,? FROM rl_pickups p JOIN rl_organizations o ON o.id=p.receiverId WHERE p.listingId=? AND p.id<>? AND p.status='declined' AND p.updatedAt=?`,
            )
            .bind(stamp, listing.id, id, stamp),
        ]);
        if (!result[0].meta.changes)
          fail(
            409,
            "The listing, partnership, or remaining capacity changed. Refresh and review the request.",
          );
        return json({ ok: true });
      }
      if (action === "pickup.collect") {
        if (me.id !== p!.receiverId)
          fail(403, "The receiving organization confirms the collection.");
        if (p!.status !== "approved")
          fail(409, "Only an approved pickup can be confirmed.");
        if (now.getTime() < Date.parse(p!.windowStart))
          fail(
            409,
            "Collection can be confirmed once the agreed pickup window starts.",
          );
        const receipt = `RL-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
        const result = await db.batch([
          db
            .prepare(
              "UPDATE rl_pickups SET status='collected',collectedAt=?,receipt=?,updatedAt=? WHERE id=? AND receiverId=? AND status='approved' AND EXISTS(SELECT 1 FROM rl_listings WHERE id=? AND assignedPickupId=? AND status='reserved')",
            )
            .bind(stamp, receipt, stamp, id, me.id, listing.id, id),
          db
            .prepare(
              "UPDATE rl_listings SET status='collected',version=version+1,updatedAt=? WHERE id=? AND assignedPickupId=? AND EXISTS(SELECT 1 FROM rl_pickups WHERE id=? AND status='collected' AND receipt=?)",
            )
            .bind(stamp, listing.id, id, id, receipt),
          notice(
            db,
            p!.donorId,
            "pickup",
            `pickup:${id}:collected`,
            "Collection confirmed",
            `${me.name} confirmed receipt of ${listing.kg} kg of ${listing.name}.`,
            id,
            stamp,
            "EXISTS(SELECT 1 FROM rl_pickups WHERE id=? AND status='collected' AND receipt=?)",
            [id, receipt],
          ),
        ]);
        if (!result[0].meta.changes)
          fail(
            409,
            "This pickup has already changed. Refresh to see its receipt.",
          );
        return json({ ok: true, receipt });
      }
      if (action === "pickup.cancel" || action === "pickup.decline") {
        if (
          action === "pickup.decline" &&
          (me.id !== p!.donorId || p!.status !== "requested")
        )
          fail(403, "Only the donor can decline a pending request.");
        if (!["requested", "approved"].includes(p!.status))
          fail(409, "This pickup is already closed.");
        const status = action === "pickup.decline" ? "declined" : "cancelled";
        const result = await db.batch([
          db
            .prepare(
              "UPDATE rl_pickups SET status=?,updatedAt=? WHERE id=? AND status=?",
            )
            .bind(status, stamp, id, p!.status),
          db
            .prepare(
              "UPDATE rl_listings SET status='available',assignedPickupId=NULL,version=version+1,updatedAt=? WHERE id=? AND assignedPickupId=? AND status='reserved' AND EXISTS(SELECT 1 FROM rl_pickups WHERE id=? AND status=?)",
            )
            .bind(stamp, listing.id, id, id, status),
          notice(
            db,
            counterpart,
            "pickup",
            `pickup:${id}:${status}`,
            `Pickup ${status}`,
            `${me.name} ${status} the pickup for ${listing.name}.`,
            id,
            stamp,
            "EXISTS(SELECT 1 FROM rl_pickups WHERE id=? AND status=?)",
            [id, status],
          ),
        ]);
        if (!result[0].meta.changes)
          fail(409, "This pickup changed. Refresh before continuing.");
        return json({ ok: true });
      }
    }
    if (action === "message.send") {
      const id = idSchema.parse(input.pickupId),
        body = z.string().trim().min(1).max(2000).parse(input.body);
      await throttle(db, request, "message", account!.id, 30, now, 60);
      const p = await db
        .prepare(
          "SELECT * FROM rl_pickups WHERE id=? AND (donorId=? OR receiverId=?)",
        )
        .bind(id, me.id, me.id)
        .first<Pickup>();
      if (!p) fail(404, "Pickup conversation not found.");
      if (["cancelled", "declined"].includes(p!.status))
        fail(
          409,
          "This conversation is closed because the pickup was cancelled or declined.",
        );
      const messageId = crypto.randomUUID();
      await db.batch([
        db
          .prepare(
            "INSERT INTO rl_messages(id,pickupId,authorId,body,createdAt) VALUES(?,?,?,?,?)",
          )
          .bind(messageId, id, me.id, body, stamp),
        notice(
          db,
          me.id === p!.donorId ? p!.receiverId : p!.donorId,
          "message",
          `message:${messageId}`,
          "New pickup message",
          `${me.name} sent a message about ${(await getFood(db, p!.listingId)).name}.`,
          id,
          stamp,
        ),
      ]);
      return json({ ok: true, id: messageId }, 201);
    }
    fail(400, "Unknown application action.");
  } catch (error) {
    if (error instanceof AppError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: error.issues
            .map(
              (i) =>
                `${i.path.filter((p) => p !== "action").join(".")}: ${i.message}`,
            )
            .join(" "),
        },
        400,
      );
    console.error(
      "RescueLoop request failed; database or runtime unavailable.",
      error instanceof Error
        ? `${error.name}: ${error.message.slice(0, 240)}`
        : "Unknown runtime error",
    );
    return json(
      {
        error: "This request could not be saved. Please refresh and try again.",
      },
      500,
    );
  }
}
