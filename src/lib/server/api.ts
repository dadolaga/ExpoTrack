import {
  matchesEtag, privateJson, readResponse, validScope,
} from "./http";

import type { ServerRepository } from "./repository";

export function createReadApi(repository: ServerRepository) {
  return {
    bootstrap: (request: Request) => readResponse(async () => {
      const bootstrap = await repository.bootstrap();
      const etag = `"${bootstrap.configHash}"`;

      if (matchesEtag(request, etag)) {
        return new Response(null, {
          status: 304,
          headers: {
            ETag: etag,
            "Cache-Control": "private, no-store",
          },
        });
      }

      return privateJson(bootstrap, 200, etag);
    }),
    profiles: () => readResponse(async () => privateJson({
      profiles: await repository.profiles(),
    })),
    catalog: (eventId: string) => readResponse(async () => {
      if (!validScope(eventId)) {
        return privateJson({
          error: "invalid_scope",
        }, 400);
      }
      const { configHash, catalog } = await repository.bootstrap();
      const event = catalog.config.events.find((entry) => entry.id === eventId);

      if (event === undefined) {
        return privateJson({
          error: "not_found",
        }, 404);
      }

      return privateJson({
        configHash,
        event,
        categories: catalog.categories,
        pavilions: catalog.pavilions.filter((entry) => entry.eventId === eventId),
        stands: catalog.stands.filter((entry) => entry.eventId === eventId),
      });
    }),
    collection: (profileId: string, eventId: string) => readResponse(async () => {
      if (!validScope(profileId, eventId)) {
        return privateJson({
          error: "invalid_scope",
        }, 400);
      }

      return privateJson(await repository.collection(profileId, eventId));
    }),
  };
}
