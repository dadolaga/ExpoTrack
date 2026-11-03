import { createReadApi } from "@/lib/server/api";
import { readResponse } from "@/lib/server/http";
import { serverRepository } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return readResponse(() => createReadApi(serverRepository()).bootstrap(request));
}
