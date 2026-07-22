import { initializeEvent } from "@/lib/data-store";
import { errorJson, json } from "@/lib/api";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }

    const { eventId } = await params;
    const event = await initializeEvent(eventId);
    return json({ event });
  } catch (error) {
    return errorJson(error);
  }
}
