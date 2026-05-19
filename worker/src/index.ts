import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db";
import { initProviders } from "./providers";
import { authMiddleware } from "./auth";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";
import { generateRoutes } from "./routes/generate";
import { imageRoutes } from "./routes/image";
import type { AppEnv } from "./types";

initProviders();

const app = new Hono<AppEnv>();

app.use("*", cors({
  origin: (origin, c) => {
    if (!origin) return null;

    const allowedOrigins = (c.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((item: string) => item.trim())
      .filter(Boolean);

    return allowedOrigins.includes(origin) ? origin : null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Inject DB into context
app.use("*", async (c, next) => {
  if (!c.get("db")) {
    c.set("db", createDb(c.env.DB));
  }
  await next();
});

// Protected auth route (must be before generic /api/auth)
app.get("/api/auth/me", authMiddleware, (c) => {
  const auth = c.get("auth");
  return c.json({
    id: auth.userId,
    name: auth.user.name,
    email: auth.user.email,
    image: auth.user.image,
  });
});

// Public auth routes (login, register)
app.route("/api/auth", authRoutes);

// Protected API routes
app.use("/api/chats/*", authMiddleware);
app.use("/api/generate/*", authMiddleware);
app.use("/api/images/*", authMiddleware);

app.route("/api/chats", chatRoutes);
app.route("/api/generate", generateRoutes);
app.route("/api/images", imageRoutes);

// Health check
app.get("/api/health", (c) => c.json({ ok: true }));

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
