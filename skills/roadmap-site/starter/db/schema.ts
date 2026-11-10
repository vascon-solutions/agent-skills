import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const snapshot = sqliteTable("roadmap_snapshot", {
  id: integer("id").primaryKey(),
  commitSha: text("commit_sha").notNull(),
  author: text("author").notNull(),
  generatedAt: text("generated_at").notNull(),
  pushedAt: text("pushed_at").notNull(),
  data: text("data").notNull(),
});

export const itemState = sqliteTable("roadmap_item_state", {
  itemId: text("item_id").primaryKey(),
  status: text("status"),
  base: text("base"),
  note: text("note").notNull().default(""),
  link: text("link").notNull().default(""),
  version: integer("version").notNull().default(0),
  editorName: text("editor_name"),
  updatedAt: text("updated_at"),
});

export const comments = sqliteTable("roadmap_comment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: text("item_id").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});

export const activity = sqliteTable("roadmap_activity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: text("at").notNull(),
  kind: text("kind").notNull(),
  itemId: text("item_id"),
  actorName: text("actor_name").notNull(),
  detail: text("detail").notNull().default(""),
});
