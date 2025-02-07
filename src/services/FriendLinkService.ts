import { eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { friendLinks, type FriendLink, type NewFriendLink } from "../db/schema";
import type { D1Database } from "@cloudflare/workers-types";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema";

export class FriendLinkService {
  private db: DrizzleD1Database<typeof schema>;

  public constructor(d1: D1Database) {
    this.db = getDb(d1);
  }

  public async getAll(): Promise<FriendLink[]> {
    return await this.db.select().from(friendLinks).orderBy(friendLinks.createdDate);
  }

  public async getActive(): Promise<FriendLink[]> {
    return await this.db
      .select()
      .from(friendLinks)
      .where(eq(friendLinks.status, "active"))
      .orderBy(friendLinks.createdDate);
  }

  public async getById(id: string): Promise<FriendLink | undefined> {
    const results = await this.db
      .select()
      .from(friendLinks)
      .where(eq(friendLinks.id, id));
    return results[0];
  }

  public async create(data: Omit<NewFriendLink, "id" | "createdDate" | "updatedDate">): Promise<FriendLink> {
    const [friendLink] = await this.db.insert(friendLinks).values(data).returning();
    return friendLink;
  }

  public async update(id: string, data: Partial<Omit<NewFriendLink, "id" | "createdDate" | "updatedDate">>): Promise<FriendLink | undefined> {
    const [updated] = await this.db
      .update(friendLinks)
      .set({
        ...data,
        updatedDate: new Date(),
      })
      .where(eq(friendLinks.id, id))
      .returning();
    return updated;
  }

  public async delete(id: string): Promise<boolean> {
    await this.db.delete(friendLinks).where(eq(friendLinks.id, id));
    return true;
  }
} 