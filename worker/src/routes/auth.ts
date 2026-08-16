import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { hashPassword, verifyPassword, createJWT, needsPasswordRehash } from "../auth";
import type { AppEnv } from "../types";

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(100),
  inviteCode: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/register", async (c) => {
  const db = c.get("db");

  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const { email, password, name, inviteCode } = parsed.data;

  // Registration gate: if INVITE_CODE is configured, a matching invite code is required.
  const expectedInviteCode = c.env?.INVITE_CODE;
  if (expectedInviteCode) {
    if (!inviteCode || inviteCode.trim() !== expectedInviteCode) {
      return c.json({ error: "Invalid invite code" }, 403);
    }
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
  });
  if (existing) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    emailVerified: false,
  }).returning();

  const token = await createJWT(user.id, c);

  return c.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  });
});

authRoutes.post("/login", async (c) => {
  const db = c.get("db");

  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
  });
  if (!user || !user.passwordHash) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  if (needsPasswordRehash(user.passwordHash)) {
    await db.update(users).set({
      passwordHash: await hashPassword(password),
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, user.id));
  }

  const token = await createJWT(user.id, c);

  return c.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  });
});
