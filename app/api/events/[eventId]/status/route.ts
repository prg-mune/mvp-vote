import { setEventStatus } from "@/lib/data-store";
import { errorJson, json, readBody } from "@/lib/api";
import { verifyAdminRequest } from "@/lib/admin-auth";
import type { EventStatus } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }
    const { eventId } = await params;
    const body = await readBody<{ status?: EventStatus }>(request);
    if (!body.status) {
      return errorJson(new Error("イベント状態を指定してください。"));
    }
    const event = await setEventStatus(eventId, body.status);
    return json({ event });
  } catch (error) {
    return errorJson(error);
  }
}
