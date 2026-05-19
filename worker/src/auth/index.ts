import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import * as jose from "jose";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import type { AppEnv } from "../types";

const JWT_EXPIRATION = "7d";
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BITS = 256;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;

  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return diff === 0;
}

function getSecret(c: Context<AppEnv>): Uint8Array {
  const secret = c.env?.JWT_SECRET;
  if (!secret && c.env?.ENVIRONMENT === "production") {
    throw new Error("JWT_SECRET is required in production");
  }

  const resolvedSecret = secret || "typix-dev-secret-change-in-production";
  return new TextEncoder().encode(resolvedSecret);
}

async function legacySha256(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(hashBuffer));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    keyMaterial,
    PASSWORD_KEY_BITS,
  );
  return toHex(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const hash = await pbkdf2(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${toHex(salt)}$${hash}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split("$");
  if (parts[0] === "pbkdf2-sha256" && parts.length === 4) {
    const iterations = Number.parseInt(parts[1]!, 10);
    const salt = fromHex(parts[2]!);
    const expected = parts[3]!;
    const actual = await pbkdf2(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  }

  const legacyHash = await legacySha256(password);
  return timingSafeEqual(legacyHash, hash);
}

export function needsPasswordRehash(hash: string): boolean {
  return !hash.startsWith("pbkdf2-sha256$");
}

export async function createJWT(userId: string, c: Context<AppEnv>): Promise<string> {
  const secret = getSecret(c);
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(secret);
}

export async function verifyJWT(token: string, c: Context<AppEnv>): Promise<string | null> {
  try {
    const secret = getSecret(c);
    const { payload } = await jose.jwtVerify(token, secret);
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

export const authMiddleware: MiddlewareHandler<AppEnv> = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const userId = await verifyJWT(token, c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = c.get("db");
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  c.set("auth", { userId, user });
  await next();
});
