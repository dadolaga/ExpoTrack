import { createReadApi } from "@/lib/server/api";
import { readResponse } from "@/lib/server/http";
import { serverRepository } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return readResponse(() => createReadApi(serverRepository()).profiles());
}
