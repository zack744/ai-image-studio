import { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import * as jose from "jose";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import type { DbType } from "../db";

const JWT_EXPIRATION = "7d";

function getSecret(c: Context): Uint8Array {
  const secret = c.env?.JWT_SECRET || "typix-dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashed = await hashPassword(password);
  return hashed === hash;
}

export async function createJWT(userId: string, c: Context): Promise<string> {
  const secret = getSecret(c);
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(secret);
}

export async function verifyJWT(token: string, c: Context): Promise<string | null> {
  try {
    const secret = getSecret(c);
    const { payload } = await jose.jwtVerify(token, secret);
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

export interface AuthContext {
  userId: string;
  user: typeof users.$inferSelect;
}

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: { auth: AuthContext } }> = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const userId = await verifyJWT(token, c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = c.get("db") as DbType;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  c.set("auth", { userId, user });
  await next();
});
