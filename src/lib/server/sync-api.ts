import { identity } from "../sync/contracts";

import { privateJson } from "./http";
import { SyncRequestError } from "./sync";

export async function syncResponse(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SyncRequestError) {
      return privateJson({
        error: error.code,
      }, error.status);
    }

    return privateJson({
      error: "server_unavailable",
    }, 503);
  }
}

export function checkMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;

  if (fetchSite === "cross-site" || (origin !== null && new URL(origin).host !== host)) {
    throw new SyncRequestError("invalid_origin", 403);
  }
}

export function photoScope(params: {
  profileId: string;
  eventId: string;
  photoId: string;
}) {
  return {
    profileId: identity(params.profileId),
    eventId: identity(params.eventId),
  };
}
