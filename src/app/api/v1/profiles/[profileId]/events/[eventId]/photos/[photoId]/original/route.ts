import { privateJson } from "@/lib/server/http";
import { serverMedia } from "@/lib/server/runtime";
import { checkMutationOrigin, photoScope, syncResponse } from "@/lib/server/sync-api";
import { identity } from "@/lib/sync/contracts";

type Context = {
  params: Promise<{
    profileId: string;
    eventId: string;
    photoId: string;
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: Context) {
  return syncResponse(async () => {
    checkMutationOrigin(request);
    const params = await context.params;

    return privateJson(await serverMedia().upload(photoScope(params), identity(params.photoId), request));
  });
}

export async function GET(request: Request, context: Context) {
  return syncResponse(async () => {
    const params = await context.params;
    const variant = new URL(request.url).searchParams.get("variant") ?? "original";

    return serverMedia().download(photoScope(params), identity(params.photoId), variant);
  });
}
