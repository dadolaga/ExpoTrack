import { ServerNotFoundError } from "./repository";

export function privateJson(value: unknown, status = 200, etag?: string): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...(etag === undefined ? {} : {
        ETag: etag,
      }),
    },
  });
}

export function matchesEtag(request: Request, etag: string) {
  return request.headers.get("if-none-match")?.split(",")
    .some((value) => value.trim().replace(/^W\//, "") === etag || value.trim() === "*") ?? false;
}

export async function readResponse(read: () => Promise<Response>): Promise<Response> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof ServerNotFoundError) {
      return privateJson({
        error: "not_found",
      }, 404);
    }

    // Avoid returning/logging driver messages containing connection strings or personal data.
    return privateJson({
      error: "server_unavailable",
    }, 503);
  }
}

export function validScope(...values: string[]) {
  return values.every((value) => /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value));
}
