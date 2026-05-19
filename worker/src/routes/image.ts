import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { files } from "../db/schema";
import type { DbType } from "../db";

export const imageRoutes = new Hono<{ Bindings: Env }>();

// POST /images/upload — upload an image to R2
imageRoutes.post("/upload", async (c) => {
  const db = c.get("db") as DbType;
  const { userId } = c.get("auth");

  const formData = await c.req.formData();
  const imageFile = formData.get("file");

  if (!imageFile || !(imageFile instanceof File)) {
    return c.json({ error: "No image file provided" }, 400);
  }

  if (imageFile.size > 10 * 1024 * 1024) {
    return c.json({ error: "Image size must be less than 10MB" }, 400);
  }

  const id = crypto.randomUUID();
  const key = `uploads/${userId}/${new Date().toISOString().slice(0, 10)}/${id}.${imageFile.type.split("/")[1] || "png"}`;

  // Upload to R2
  if (c.env?.R2) {
    await c.env.R2.put(key, imageFile.stream(), {
      httpMetadata: { contentType: imageFile.type },
    });
  }

  const url = c.env?.R2
    ? `${c.env.R2_PUBLIC_URL || ""}/${key}`
    : `data:${imageFile.type};base64,`; // Fallback for local dev

  const [file] = await db.insert(files).values({
    userId,
    storage: "r2",
    url,
  }).returning();

  return c.json({
    id: file!.id,
    url,
  });
});

// GET /images/:id — get image URL
imageRoutes.get("/:id", async (c) => {
  const db = c.get("db") as DbType;
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
