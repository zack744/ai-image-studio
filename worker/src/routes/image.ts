import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { files } from "../db/schema";
import type { AppEnv } from "../types";

export const imageRoutes = new Hono<AppEnv>();

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// POST /images/upload — upload an image to R2
imageRoutes.post("/upload", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");

  const formData = await c.req.formData();
  const imageFile = formData.get("file") as File | string | null;

  if (!imageFile || typeof imageFile === "string") {
    return c.json({ error: "No image file provided" }, 400);
  }

  if (!imageFile.type.startsWith("image/")) {
    return c.json({ error: "Only image files are supported" }, 400);
  }

  if (imageFile.size > 10 * 1024 * 1024) {
    return c.json({ error: "Image size must be less than 10MB" }, 400);
  }

  const id = crypto.randomUUID();
  const key = `uploads/${userId}/${new Date().toISOString().slice(0, 10)}/${id}.${imageFile.type.split("/")[1] || "png"}`;

  const r2 = c.env.R2;
  const publicUrl = c.env.R2_PUBLIC_URL;
  const canUsePublicR2 = Boolean(r2 && publicUrl);

  if (canUsePublicR2 && r2) {
    await r2.put(key, imageFile.stream(), {
      httpMetadata: { contentType: imageFile.type },
    });
  }

  const url = canUsePublicR2
    ? `${publicUrl!.replace(/\/$/, "")}/${key}`
    : `data:${imageFile.type};base64,${bytesToBase64(new Uint8Array(await imageFile.arrayBuffer()))}`;

  const [file] = await db.insert(files).values({
    userId,
    storage: canUsePublicR2 ? "r2" : "base64",
    url,
  }).returning();

  return c.json({
    id: file!.id,
    url,
  });
});

// GET /images/:id — get image URL
imageRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  const file = await db.query.files.findFirst({
    where: and(eq(files.id, id), eq(files.userId, userId)),
  });
  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  return c.json({
    id: file.id,
    url: file.url,
    storage: file.storage,
  });
});
