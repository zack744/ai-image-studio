import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { chats, messages, messageAttachments, messageGenerations, files } from "../db/schema";
import type { DbType } from "../db";
import type { AppEnv } from "../types";

const createChatSchema = z.object({
  title: z.string().min(1).max(500),
  provider: z.string().min(1),
  model: z.string().min(1),
  content: z.string().optional(),
  images: z.array(z.string().max(14 * 1024 * 1024)).max(10).optional(),
  attachments: z.array(z.object({
    data: z.string().max(14 * 1024 * 1024),
    type: z.enum(["image"]).default("image"),
  })).max(10).optional(),
  imageCount: z.number().int().min(1).max(10).default(1),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
});

const createMessageSchema = z.object({
  chatId: z.string().min(1),
  content: z.string(),
  provider: z.string().min(1),
  model: z.string().min(1),
  type: z.enum(["text"]).default("text"),
  images: z.array(z.string().max(14 * 1024 * 1024)).max(10).optional(),
  attachments: z.array(z.object({
    data: z.string().max(14 * 1024 * 1024),
    type: z.enum(["image"]).default("image"),
  })).max(10).optional(),
  imageCount: z.number().int().min(1).max(10).default(1),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
});

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

function extensionFromMime(mime: string): string {
  const subtype = mime.split("/")[1]?.toLowerCase() || "png";
  if (subtype === "jpeg") return "jpg";
  if (subtype === "svg+xml") return "svg";
  return subtype.replace(/[^a-z0-9]/g, "") || "png";
}

function decodeImageDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error("INVALID_IMAGE_DATA");
  }

  const [, mime, base64] = match;
  const binary = atob(base64);
  if (binary.length > MAX_ATTACHMENT_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return { mime, bytes };
}

async function storeImageData(db: DbType, env: Env, userId: string, dataUrl: string) {
  const parsed = decodeImageDataUrl(dataUrl);

  if (env.R2 && env.R2_PUBLIC_URL) {
    const id = crypto.randomUUID();
    const key = `uploads/${userId}/${new Date().toISOString().slice(0, 10)}/${id}.${extensionFromMime(parsed.mime)}`;
    await env.R2.put(key, parsed.bytes, {
      httpMetadata: { contentType: parsed.mime },
    });

    const [file] = await db.insert(files).values({
      userId,
      storage: "r2",
      url: `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`,
    }).returning();

    return file!;
  }

  const [file] = await db.insert(files).values({
    userId,
    storage: "base64",
    url: dataUrl,
  }).returning();

  return file!;
}

function getPublicImageUrls(attachments: Array<{ url: string | null }>): string[] {
  return attachments
    .map((attachment) => attachment.url)
    .filter((url): url is string => Boolean(url && /^https?:\/\//.test(url)));
}

function hasIncomingImages(req: { attachments?: Array<unknown>; images?: string[] }): boolean {
  return Boolean((req.attachments && req.attachments.length > 0) || (req.images && req.images.length > 0));
}

function canCreatePublicImageUrls(env: Env): boolean {
  return Boolean(env.R2 && env.R2_PUBLIC_URL);
}

export const chatRoutes = new Hono<AppEnv>();

chatRoutes.get("/", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");

  const result = await db.query.chats.findMany({
    where: and(eq(chats.userId, userId), eq(chats.deleted, false)),
    orderBy: [desc(chats.createdAt)],
  });

  return c.json(result);
});

chatRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, id), eq(chats.userId, userId), eq(chats.deleted, false)),
  });

  if (!chat) {
    return c.json(null);
  }

  // Load messages separately
  const chatMessages = await db.query.messages.findMany({
    where: eq(messages.chatId, id),
    orderBy: [messages.createdAt],
  });

  const enrichedMessages = await Promise.all(chatMessages.map(async (msg) => {
    let generation: Record<string, any> | null = null;
    if (msg.generationId) {
      const gen = await db.query.messageGenerations.findFirst({
        where: eq(messageGenerations.id, msg.generationId),
      });
      if (gen) {
        generation = { ...gen };
        // Resolve resultUrls from fileIds for completed generations
        if (gen.status === "completed" && gen.fileIds) {
          const genFileIds = gen.fileIds as string[];
          const genFileRecords = await Promise.all(
            genFileIds.map((fid) => db.query.files.findFirst({ where: eq(files.id, fid) })),
          );
          generation.resultUrls = genFileRecords.filter(Boolean).map((f) => f!.url);
        }
      }
    }

    const atts = await db.query.messageAttachments.findMany({
      where: eq(messageAttachments.messageId, msg.id),
    });
    const attachmentUrls = await Promise.all(atts.map(async (att) => {
      const file = await db.query.files.findFirst({
        where: eq(files.id, att.fileId),
      });
      return { id: att.id, type: att.type, url: file?.url || null };
    }));

    return { ...msg, attachments: attachmentUrls, generation };
  }));

  return c.json({ ...chat, messages: enrichedMessages });
});

chatRoutes.post("/", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");

  const body = await c.req.json();
  const parsed = createChatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const req = parsed.data;
  if (hasIncomingImages(req) && !canCreatePublicImageUrls(c.env)) {
    return c.json({ error: "R2_PUBLIC_URL is required for image-to-image generation" }, 500);
  }

  const [chat] = await db.insert(chats).values({
    userId,
    title: req.title,
    provider: req.provider,
    model: req.model,
  }).returning();

  if (req.content) {
    const result = await createMessageInternal(db, c.env, userId, {
      chatId: chat!.id,
      content: req.content,
      provider: req.provider,
      model: req.model,
      type: "text",
      attachments: req.attachments,
      images: req.images,
      imageCount: req.imageCount,
      aspectRatio: req.aspectRatio,
    });

    return c.json({ id: chat!.id, messages: result.messages });
  }

  return c.json({ id: chat!.id });
});

chatRoutes.put("/:id", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  const body = await c.req.json();
  const { title, provider, model } = body;

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, id), eq(chats.userId, userId)),
  });
  if (!chat) {
    return c.json({ error: "Chat not found" }, 404);
  }

  const updateData: Record<string, any> = {};
  if (title) updateData.title = title;
  if (provider) updateData.provider = provider;
  if (model) updateData.model = model;

  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = new Date().toISOString();
    await db.update(chats).set(updateData).where(eq(chats.id, id));
  }

  return c.json({ success: true });
});

chatRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, id), eq(chats.userId, userId)),
  });
  if (!chat) {
    return c.json({ error: "Chat not found" }, 404);
  }

  await db.update(chats).set({ deleted: true }).where(eq(chats.id, id));
  return c.json({ success: true });
});

// Message routes
chatRoutes.post("/:chatId/messages", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");
  const chatId = c.req.param("chatId");

  const body = await c.req.json();
  const parsed = createMessageSchema.safeParse({ ...body, chatId });
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
  });
  if (!chat) {
    return c.json({ error: "Chat not found" }, 404);
  }

  if (hasIncomingImages(parsed.data) && !canCreatePublicImageUrls(c.env)) {
    return c.json({ error: "R2_PUBLIC_URL is required for image-to-image generation" }, 500);
  }

  const result = await createMessageInternal(db, c.env, userId, parsed.data);
  return c.json(result);
});

chatRoutes.delete("/:chatId/messages/:messageId", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");
  const chatId = c.req.param("chatId");
  const messageId = c.req.param("messageId");

  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
    with: { chat: true },
  });

  if (!message || message.chat.userId !== userId || message.chatId !== chatId) {
    return c.json({ error: "Message not found" }, 404);
  }

  await db.delete(messageAttachments).where(eq(messageAttachments.messageId, messageId));
  await db.delete(messages).where(eq(messages.id, messageId));
  await db.update(chats).set({ updatedAt: new Date().toISOString() }).where(eq(chats.id, chatId));

  return c.json({ success: true });
});

export async function createMessageInternal(
  db: DbType,
  env: Env,
  userId: string,
  req: { chatId: string; content: string; provider: string; model: string; type?: string; images?: string[]; attachments?: Array<{ data: string; type: "image" }>; imageCount?: number; aspectRatio?: string },
) {
  const now = new Date().toISOString();

  const [userMessage] = await db.insert(messages).values({
    userId,
    chatId: req.chatId,
    content: req.content,
    role: "user",
    type: (req.type || "text") as any,
  }).returning();

  const attachmentResults: Array<{ id: string; type: string; url: string | null }> = [];

  if (req.attachments && req.attachments.length > 0) {
    if (!env.R2 || !env.R2_PUBLIC_URL) {
      throw new Error("R2_PUBLIC_URL_REQUIRED");
    }

    for (let i = 0; i < req.attachments.length; i++) {
      const att = req.attachments[i];
      const file = await storeImageData(db, env, userId, att.data);

      if (file) {
        await db.insert(messageAttachments).values({
          messageId: userMessage!.id,
          fileId: file.id,
          type: att.type,
        });

        attachmentResults.push({
          id: file.id,
          type: att.type,
          url: file.url,
        });
      }
    }
    // Support deprecated images field
  } else if (req.images && req.images.length > 0) {
    if (!env.R2 || !env.R2_PUBLIC_URL) {
      throw new Error("R2_PUBLIC_URL_REQUIRED");
    }

    for (let i = 0; i < req.images.length; i++) {
      const data = req.images[i];
      const file = await storeImageData(db, env, userId, data);

      if (file) {
        await db.insert(messageAttachments).values({
          messageId: userMessage!.id,
          fileId: file.id,
          type: "image",
        });

        attachmentResults.push({
          id: file.id,
          type: "image",
          url: file.url,
        });
      }
    }
  }

  await db.update(chats).set({ updatedAt: now }).where(eq(chats.id, req.chatId));
  const imageUrls = getPublicImageUrls(attachmentResults);

  const [generation] = await db.insert(messageGenerations).values({
    userId,
    prompt: req.content,
    provider: req.provider,
    model: req.model,
    type: "image",
    status: "pending",
    parameters: {
      imageCount: req.imageCount || 1,
      aspectRatio: req.aspectRatio,
      images: imageUrls,
    },
  }).returning();

  const [assistantMessage] = await db.insert(messages).values({
    userId,
    chatId: req.chatId,
    content: "",
    role: "assistant",
    type: "image",
    generationId: generation!.id,
  }).returning();

  return {
    messages: [
      { ...userMessage!, generation: null, attachments: attachmentResults },
      { ...assistantMessage!, generation: generation!, attachments: [] },
    ],
  };
}
