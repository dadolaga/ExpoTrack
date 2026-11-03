import { createReadApi } from "@/lib/server/api";
import { readResponse } from "@/lib/server/http";
import { serverRepository } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: {
  params: Promise<{
    eventId: string;
  }>;
}) {
  const { eventId } = await context.params;

  return readResponse(() => createReadApi(serverRepository()).catalog(eventId));
}
