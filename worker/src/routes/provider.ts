import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { aiProviders } from "../db/schema";
import type { AppEnv } from "../types";

const upsertSchema = z.object({
  enabled: z.boolean().optional(),
  settings: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const providerRoutes = new Hono<AppEnv>();

// GET /api/providers — list the current user's provider configs (incl. API keys)
providerRoutes.get("/", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");

  const rows = await db.query.aiProviders.findMany({
    where: eq(aiProviders.userId, userId),
  });

  return c.json(rows);
});

// GET /api/providers/:providerId — single provider config
providerRoutes.get("/:providerId", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");
  const providerId = c.req.param("providerId");

  const row = await db.query.aiProviders.findFirst({
    where: and(eq(aiProviders.userId, userId), eq(aiProviders.providerId, providerId)),
  });

  return c.json(row || null);
});

// PUT /api/providers/:providerId — create or update provider config
providerRoutes.put("/:providerId", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");
  const providerId = c.req.param("providerId");

  const body = await c.req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.aiProviders.findFirst({
    where: and(eq(aiProviders.userId, userId), eq(aiProviders.providerId, providerId)),
  });

  const now = new Date().toISOString();

  if (existing) {
    await db.update(aiProviders).set({
      enabled: parsed.data.enabled ?? existing.enabled,
      settings: parsed.data.settings !== undefined ? parsed.data.settings : existing.settings,
      updatedAt: now,
    }).where(eq(aiProviders.id, existing.id));

    return c.json({
      id: existing.id,
      providerId,
      userId,
      enabled: parsed.data.enabled ?? existing.enabled,
      settings: parsed.data.settings !== undefined ? parsed.data.settings : existing.settings,
    });
  }

  const [row] = await db.insert(aiProviders).values({
    providerId,
    userId,
    enabled: parsed.data.enabled ?? true,
    settings: parsed.data.settings ?? {},
  }).returning();

  return c.json(row);
});

// DELETE /api/providers/:providerId — remove provider config
providerRoutes.delete("/:providerId", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");
  const providerId = c.req.param("providerId");

  await db.delete(aiProviders).where(
    and(eq(aiProviders.userId, userId), eq(aiProviders.providerId, providerId)),
  );

  return c.json({ success: true });
});
