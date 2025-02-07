import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary").notNull(),
  rendered: text("rendered"),
  meta: text("meta").$type<Record<string, any>>(),
  createdDate: integer("created_date", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedDate: integer("updated_date", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const friendLinks = sqliteTable("friend_links", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  avatar: text("avatar"),
  status: text("status").notNull().$type<"active" | "inactive">().default("active"),
  createdDate: integer("created_date", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedDate: integer("updated_date", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Export type for TypeScript usage
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type FriendLink = typeof friendLinks.$inferSelect;
export type NewFriendLink = typeof friendLinks.$inferInsert;
