import { sql } from "drizzle-orm";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary").notNull(),
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
