import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { messageGenerations, messages, files } from "../db/schema";
import { getProvider } from "../providers";
import { logger } from "../lib/logger";
import type { AppEnv } from "../types";

export const generateRoutes = new Hono<AppEnv>();

// POST /generate — submit a generation task (returns immediately with taskId)
generateRoutes.post("/", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");

  const body = await c.req.json();
  const generationId = body.generationId as string;
  if (!generationId) {
    return c.json({ error: "generationId is required" }, 400);
  }

  const generation = await db.query.messageGenerations.findFirst({
    where: and(eq(messageGenerations.id, generationId), eq(messageGenerations.userId, userId)),
  });
  if (!generation) {
    return c.json({ error: "Generation not found" }, 404);
  }

  if (generation.status !== "pending") {
    return c.json({ error: "Generation already submitted", status: generation.status }, 400);
  }

  const params = (generation.parameters as any) || {};
  const apiKey = c.env?.SUCHUANG_API_KEY || "";
  if (!apiKey) {
    await db.update(messageGenerations).set({
      status: "failed",
      errorReason: "CONFIG_ERROR",
      updatedAt: new Date().toISOString(),
    }).where(eq(messageGenerations.id, generationId));
    return c.json({ error: "Provider API key is not configured" }, 500);
  }

  const provider = getProvider(generation.provider);
  if (!provider) {
    logger.error("Provider not found", { generationId, provider: generation.provider });
    await db.update(messageGenerations).set({
      status: "failed",
      errorReason: `Provider ${generation.provider} not found`,
      updatedAt: new Date().toISOString(),
    }).where(eq(messageGenerations.id, generationId));
    return c.json({ error: `Provider ${generation.provider} not found` }, 400);
  }

  logger.info("Submitting generation", { generationId, provider: generation.provider, prompt: generation.prompt.slice(0, 80) });

  try {
    const taskId = await provider.submit(generation.prompt, {
      prompt: generation.prompt,
      images: params.images || [],
      aspectRatio: params.aspectRatio,
      n: params.imageCount || 1,
    }, apiKey);

    logger.info("Generation submitted", { generationId, taskId });

    await db.update(messageGenerations).set({
      status: "generating",
      parameters: { ...params, taskId, submittedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    }).where(eq(messageGenerations.id, generationId));

    return c.json({ success: true, generationId });
  } catch (error: any) {
    logger.error("Submit generation failed", { generationId, error: error.message });

    await db.update(messageGenerations).set({
      status: "failed",
      errorReason: error.message || "Submit failed",
      updatedAt: new Date().toISOString(),
    }).where(eq(messageGenerations.id, generationId));

    return c.json({ error: error.message || "Submit failed" }, 500);
  }
});

// GET /generate/:id — poll generation status (proactively checks provider on each request)
generateRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  let generation = await db.query.messageGenerations.findFirst({
    where: and(eq(messageGenerations.id, id), eq(messageGenerations.userId, userId)),
  });
  if (!generation) {
    return c.json(null);
  }

  // Auto-timeout check
  const lastUpdate = new Date(generation.updatedAt).getTime();
  const elapsed = Date.now() - lastUpdate;
  if (elapsed > 5 * 60 * 1000) {
    await db.update(messageGenerations).set({
      status: "failed",
      errorReason: "TIMEOUT",
      updatedAt: new Date().toISOString(),
    }).where(eq(messageGenerations.id, id));

    generation = { ...generation, status: "failed" as const, errorReason: "TIMEOUT" };
  }

  // If still pending, the frontend never triggered generation — warn loudly
  if (generation.status === "pending") {
    logger.warn("Poll called but generation still pending — POST /api/generate was never received", { generationId: id });
  }

  // If generating and has a taskId, poll the provider once
  if (generation.status === "generating") {
    const params = generation.parameters as any;
    const provider = getProvider(generation.provider);

    if (provider && params?.taskId) {
      try {
        const apiKey = c.env?.SUCHUANG_API_KEY || "";
        if (!apiKey) {
          await db.update(messageGenerations).set({
            status: "failed",
            errorReason: "CONFIG_ERROR",
            updatedAt: new Date().toISOString(),
          }).where(eq(messageGenerations.id, id));
          generation = { ...generation, status: "failed" as const, errorReason: "CONFIG_ERROR" };
          return c.json({ ...generation, resultUrls: [] });
        }
        logger.debug("Polling provider", { generationId: id, taskId: params.taskId });
        const result = await provider.poll(params.taskId, apiKey);

        if (result.status === "completed" && result.images && result.images.length > 0) {
          logger.info("Generation completed", { generationId: id, imageCount: result.images.length });
          const fileIds: string[] = [];
          for (const imageUrl of result.images) {
            const [file] = await db.insert(files).values({
              userId,
              storage: "r2",
              url: imageUrl,
            }).returning();
            if (file) fileIds.push(file.id);
          }

          const generationTime = params.submittedAt
            ? Date.now() - new Date(params.submittedAt).getTime()
            : null;

          await db.update(messageGenerations).set({
            status: "completed",
            fileIds,
            generationTime,
            updatedAt: new Date().toISOString(),
          }).where(eq(messageGenerations.id, id));

          generation = { ...generation, status: "completed" as const, fileIds };
        } else if (result.status === "failed") {
          await db.update(messageGenerations).set({
            status: "failed",
            errorReason: result.error || "Generation failed",
            updatedAt: new Date().toISOString(),
          }).where(eq(messageGenerations.id, id));

          generation = { ...generation, status: "failed" as const, errorReason: result.error || "Generation failed" };
        }
      } catch (err: any) {
        logger.error("Poll failed", { generationId: id, error: err.message });
      }
    }
  }

  let resultUrls: string[] = [];
  if (generation?.fileIds) {
    const fileIds = generation.fileIds as string[];
    const fileRecords = await Promise.all(
      fileIds.map((fid) => db.query.files.findFirst({ where: eq(files.id, fid) }))
    );
    resultUrls = fileRecords.filter(Boolean).map((f) => f!.url);
  }

  return c.json({
    ...generation,
    resultUrls,
  });
});

// POST /generate/regenerate — regenerate a message
generateRoutes.post("/regenerate", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");

  const { messageId } = await c.req.json() as { messageId: string };
  if (!messageId) {
    return c.json({ error: "messageId is required" }, 400);
  }

  const message = await db.query.messages.findFirst({
    where: and(eq(messages.id, messageId), eq(messages.userId, userId), eq(messages.role, "assistant")),
    with: { generation: true },
  });
  if (!message || !message.generation) {
    return c.json({ error: "Message not found or not regeneratable" }, 404);
  }

  // Reset generation
  await db.update(messageGenerations).set({
    status: "pending",
    fileIds: null,
    errorReason: null,
    generationTime: null,
    updatedAt: new Date().toISOString(),
  }).where(eq(messageGenerations.id, message.generation.id));

  await db.update(messages).set({
    content: "",
  }).where(eq(messages.id, messageId));

  return c.json({
    messageId,
    generationId: message.generation.id,
  });
});
