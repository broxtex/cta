import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hashPassword, generateRandomString } from "better-auth/crypto";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { displayIdentifier, identifierToEmail } from "./identifier";

export type StaffRole = "owner" | "staff";

export type StaffAccount = {
  id: string;
  name: string;
  identifier: string;
  email: string;
  role: StaffRole;
  createdAt: string;
};

type StaffRow = { user_id: string; role: string };

export const SMITH_IDENTIFIER = "smith";
export const SMITH_EMAIL = identifierToEmail(SMITH_IDENTIFIER);
const SMITH_NAME = "Smith";
/** Initial owner password. Override with SMITH_OWNER_PASSWORD in production. */
const SMITH_DEFAULT_PASSWORD = "smith2026";
const SMITH_USER_ID = "usr_smith_owner";

function ownerPassword(): string {
  const fromEnv = process.env.SMITH_OWNER_PASSWORD?.trim();
  if (fromEnv && fromEnv.length >= 8) return fromEnv.slice(0, 128);
  return SMITH_DEFAULT_PASSWORD;
}

function newId(): string {
  return generateRandomString(24, "a-z", "A-Z", "0-9");
}

async function staffCount(): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from store_staff`;
  return Number(rows[0]?.n ?? 0);
}

async function roleOf(userId: string): Promise<StaffRole | null> {
  const sql = await getSql();
  const rows = await sql<StaffRow>`select user_id, role from store_staff where user_id = ${userId}`;
  const role = rows[0]?.role;
  if (role === "owner" || role === "staff") return role;
  return null;
}

/** Creates Smith as the sole owner. Does not reset an existing password. Memoized per process. */
let smithReady: Promise<string> | null = null;

export async function ensureSmithOwner(): Promise<string> {
  if (!smithReady) {
    smithReady = seedSmithOwner().catch((err) => {
      smithReady = null;
      throw err;
    });
  }
  return smithReady;
}

async function seedSmithOwner(): Promise<string> {
  const sql = await getSql();

  const byEmail = await sql<{ id: string }>`select id from "user" where email = ${SMITH_EMAIL}`;
  const byId = await sql<{ id: string }>`select id from "user" where id = ${SMITH_USER_ID}`;
  const userId = byEmail[0]?.id ?? byId[0]?.id ?? SMITH_USER_ID;
  const createdNow = byEmail.length === 0 && byId.length === 0;

  if (createdNow) {
    await sql.query(
      `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       values ($1, $2, $3, true, now(), now())`,
      [userId, SMITH_NAME, SMITH_EMAIL],
    );
  } else {
    await sql.query(
      `update "user" set "name" = $2, "email" = $3, "updatedAt" = now() where id = $1`,
      [userId, SMITH_NAME, SMITH_EMAIL],
    );
  }

  const accounts = await sql<{ id: string }>`
    select id from "account" where "userId" = ${userId} and "providerId" = 'credential'
  `;
  if (accounts.length === 0) {
    const hashed = await hashPassword(ownerPassword());
    const accountId = newId();
    await sql.query(
      `insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
       values ($1, $2, 'credential', $3, $4, now(), now())`,
      [accountId, userId, userId, hashed],
    );
  }

  await sql.query(
    `insert into store_staff (user_id, role) values ($1, 'owner')
     on conflict (user_id) do update set role = 'owner'`,
    [userId],
  );
  // Anyone else who claimed "owner" is demoted — Smith is the only administrator.
  await sql.query(`update store_staff set role = 'staff' where user_id <> $1 and role = 'owner'`, [
    userId,
  ]);

  return userId;
}

export async function requireStaff(userId: string): Promise<StaffRole> {
  await ensureSmithOwner();
  const role = await roleOf(userId);
  if (!role) {
    const err = new Error("No tienes permiso para administrar la tienda.");
    throw err;
  }
  return role;
}

export async function requireOwner(userId: string): Promise<void> {
  const role = await requireStaff(userId);
  if (role !== "owner") {
    throw new Error("Solo Smith, el dueño, puede hacer esto.");
  }
}

export const getHasOwner = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSmithOwner();
  return true;
});

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureSmithOwner();
    const n = await staffCount();
    const role = await roleOf(context.userId);
    return { role, hasOwner: n > 0 };
  });

export const claimStore = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const smithId = await ensureSmithOwner();
    if (context.userId === smithId) return { role: "owner" as const };
    const role = await roleOf(context.userId);
    if (!role) throw new Error("La tienda ya tiene dueño. Pídele a Smith que te cree una cuenta.");
    return { role };
  });

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<StaffAccount[]> => {
    await requireStaff(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      role: string;
      created_at: string | Date;
      name: string;
      email: string;
    }>`
      select s.user_id, s.role, s.created_at, u.name, u.email
      from store_staff s
      join "user" u on u.id = s.user_id
      order by case when s.role = 'owner' then 0 else 1 end, s.created_at asc
    `;
    return rows.map((r) => ({
      id: r.user_id,
      name: r.name,
      email: r.email,
      identifier: displayIdentifier(r.email),
      role: r.role === "owner" ? "owner" : "staff",
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  });

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        identifier: z.string().trim().min(2).max(80),
        password: z.string().min(8).max(128),
        name: z.string().trim().min(1).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireOwner(context.userId);
    const email = identifierToEmail(data.identifier);
    if (email === SMITH_EMAIL) {
      throw new Error("Ese usuario es el dueño y no se puede duplicar.");
    }
    const sql = await getSql();
    const existing = await sql<{ id: string }>`select id from "user" where email = ${email}`;
    if (existing.length) {
      throw new Error("Ese usuario o correo ya existe.");
    }
    const userId = newId();
    const accountId = newId();
    const hashed = await hashPassword(data.password);
    try {
      await sql.query(
        `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
         values ($1, $2, $3, false, now(), now())`,
        [userId, data.name.trim(), email],
      );
      await sql.query(
        `insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
         values ($1, $2, 'credential', $3, $4, now(), now())`,
        [accountId, userId, userId, hashed],
      );
      await sql.query(`insert into store_staff (user_id, role, created_by) values ($1, 'staff', $2)`, [
        userId,
        context.userId,
      ]);
    } catch (err) {
      await sql.query(`delete from store_staff where user_id = $1`, [userId]).catch(() => undefined);
      await sql.query(`delete from "account" where "userId" = $1`, [userId]).catch(() => undefined);
      await sql.query(`delete from "user" where id = $1`, [userId]).catch(() => undefined);
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("unique") || msg.includes("23505")) {
        throw new Error("Ese usuario o correo ya existe.");
      }
      throw new Error("No se pudo crear la cuenta. Inténtalo de nuevo.");
    }
    return { id: userId, email, identifier: displayIdentifier(email) };
  });

export const deleteStaffAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ userId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context.userId);
    if (data.userId === context.userId) throw new Error("No puedes borrar tu propia cuenta.");
    const smithId = await ensureSmithOwner();
    if (data.userId === smithId) throw new Error("No se puede borrar al dueño.");
    const target = await roleOf(data.userId);
    if (!target) throw new Error("Esa cuenta no existe.");
    if (target === "owner") throw new Error("No se puede borrar al dueño.");
    const sql = await getSql();
    await sql.query(`delete from store_staff where user_id = $1`, [data.userId]);
    await sql.query(`delete from "session" where "userId" = $1`, [data.userId]);
    await sql.query(`delete from "account" where "userId" = $1`, [data.userId]);
    await sql.query(`delete from "user" where id = $1`, [data.userId]);
    return { ok: true as const };
  });
