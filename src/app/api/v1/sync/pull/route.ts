import { privateJson } from "@/lib/server/http";
import { serverSync } from "@/lib/server/runtime";
import { syncResponse } from "@/lib/server/sync-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return syncResponse(async () => {
    const params = new URL(request.url).searchParams;

    return privateJson(await serverSync().pull(params.get("cursor")));
  });
}
