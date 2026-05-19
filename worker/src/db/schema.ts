import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { customAlphabet } from "nanoid/non-secure";

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 16);

const now = () => new Date().toISOString();

export const users = sqliteTable("user", {
  id: text().primaryKey().$defaultFn(() => nanoid()),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer({ mode: "boolean" }).notNull().default(false),
  image: text(),
  passwordHash: text("password_hash"),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const sessions = sqliteTable("session", {
  id: text().primaryKey().$defaultFn(() => nanoid()),
  expiresAt: text("expires_at").notNull(),
  token: text().notNull().unique(),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = sqliteTable("account", {
  id: text().primaryKey().$defaultFn(() => nanoid()),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text(),
  password: text(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const settings = sqliteTable("settings", {
  id: text().primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  theme: text().default("system"),
  themeColor: text("theme_color").default("default"),
  language: text().default("system"),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const chats = sqliteTable("chats", {
  id: text().primaryKey().$defaultFn(() => nanoid()),
  title: text().notNull(),
  userId: text("user_id").notNull(),
  provider: text().notNull(),
  model: text().notNull(),
  deleted: integer({ mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const messages = sqliteTable("messages", {
  id: text().primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull(),
  chatId: text("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  content: text().notNull(),
  role: text({ enum: ["user", "assistant"] }).notNull(),
  type: text({ enum: ["text", "image"] }).default("text").notNull(),
  generationId: text("generation_id").references(() => messageGenerations.id, { onDelete: "set null" }),
  metadata: text({ mode: "json" }),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const messageAttachments = sqliteTable("message_attachments", {
  id: text().primaryKey().$defaultFn(() => nanoid()),
  messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  fileId: text("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  type: text({ enum: ["image"] }).default("image").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const messageGenerations = sqliteTable("message_generations", {
  id: text().primaryKey().$defaultFn(() => nanoid()),
  type: text({ enum: ["image", "video"] }).default("image").notNull(),
  userId: text("user_id").notNull(),
  prompt: text().notNull(),
  parameters: text({ mode: "json" }),
  provider: text().notNull(),
  model: text().notNull(),
  status: text({ enum: ["pending", "generating", "completed", "failed"] }).default("pending"),
  fileIds: text("file_ids", { mode: "json" }),
  errorReason: text("error_reason"),
  generationTime: integer("generation_time", { mode: "number" }),
  cost: real(),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const files = sqliteTable("files", {
  id: text().primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull(),
  storage: text({ enum: ["base64", "r2"] }).notNull(),
  url: text().notNull(),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const aiProviders = sqliteTable(
  "ai_providers",
  {
    id: text().primaryKey().$defaultFn(() => nanoid()),
    providerId: text("provider_id").notNull().unique(),
    userId: text("user_id").notNull(),
    enabled: integer({ mode: "boolean" }).default(true).notNull(),
    settings: text({ mode: "json" }),
    createdAt: text("created_at").notNull().$defaultFn(now),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [unique().on(t.userId, t.providerId)],
);

export const aiModels = sqliteTable(
  "ai_models",
  {
    id: text().primaryKey().$defaultFn(() => nanoid()),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    enabled: integer({ mode: "boolean" }).default(true).notNull(),
    userId: text("user_id").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(now),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [unique().on(t.userId, t.providerId, t.modelId)],
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  chats: many(chats),
}));

export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  generation: one(messageGenerations, {
    fields: [messages.generationId],
    references: [messageGenerations.id],
  }),
  attachments: many(messageAttachments),
}));

export const messageAttachmentsRelations = relations(messageAttachments, ({ one }) => ({
  message: one(messages, {
    fields: [messageAttachments.messageId],
    references: [messages.id],
  }),
  file: one(files, {
    fields: [messageAttachments.fileId],
    references: [files.id],
  }),
}));

export const messageGenerationsRelations = relations(messageGenerations, ({ many }) => ({
  messages: many(messages),
}));

export const filesRelations = relations(files, ({ many }) => ({
  attachments: many(messageAttachments),
}));
