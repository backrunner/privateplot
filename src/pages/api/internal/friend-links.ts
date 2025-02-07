import type { APIRoute } from "astro";
import { FriendLinkService } from "../../../services/FriendLinkService";
import type { NewFriendLink } from "../../../db/schema";

type CreateFriendLinkBody = Omit<NewFriendLink, "id" | "createdDate" | "updatedDate">;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const service = new FriendLinkService(locals.runtime.env.DB);
    const links = await service.getAll();
    return new Response(JSON.stringify(links), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const service = new FriendLinkService(locals.runtime.env.DB);
    const data = await request.json() as CreateFriendLinkBody;
    const link = await service.create(data);
    return new Response(JSON.stringify(link), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}; 