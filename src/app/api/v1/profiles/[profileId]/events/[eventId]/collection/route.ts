import { createReadApi } from "@/lib/server/api";
import { readResponse } from "@/lib/server/http";
import { serverRepository } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: {
  params: Promise<{
    profileId: string;
    eventId: string;
  }>;
}) {
  const { profileId, eventId } = await context.params;

  return readResponse(() => createReadApi(serverRepository()).collection(profileId, eventId));
}
