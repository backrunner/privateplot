import type { APIRoute } from "astro";
import { FriendLinkService } from "../../../../services/FriendLinkService";
import type { NewFriendLink } from "../../../../db/schema";

type UpdateFriendLinkBody = Partial<Omit<NewFriendLink, "id" | "createdDate" | "updatedDate">>;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: "ID is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const service = new FriendLinkService(locals.runtime.env.DB);
    const link = await service.getById(id);
    if (!link) {
      return new Response(JSON.stringify({ error: "Friend link not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify(link), {
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

export const PUT: APIRoute = async ({ request, params, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: "ID is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const service = new FriendLinkService(locals.runtime.env.DB);
    const data = await request.json() as UpdateFriendLinkBody;
    const updated = await service.update(id, data);
    
    if (!updated) {
      return new Response(JSON.stringify({ error: "Friend link not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify(updated), {
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

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: "ID is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const service = new FriendLinkService(locals.runtime.env.DB);
    const success = await service.delete(id);
    if (!success) {
      return new Response(JSON.stringify({ error: "Friend link not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}; 