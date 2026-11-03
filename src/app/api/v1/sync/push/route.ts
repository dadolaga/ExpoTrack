import { privateJson } from "@/lib/server/http";
import { serverSync } from "@/lib/server/runtime";
import { SyncRequestError } from "@/lib/server/sync";
import { checkMutationOrigin, syncResponse } from "@/lib/server/sync-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return syncResponse(async () => {
    checkMutationOrigin(request);
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new SyncRequestError("invalid_json", 400);
    }

    return privateJson(await serverSync().push(body));
  });
}
