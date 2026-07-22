import { setVoteValidity } from "@/lib/data-store";
import { errorJson, json, readBody } from "@/lib/api";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; voteId: string }> },
) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }

    const { eventId, voteId } = await params;
    const body = await readBody<{ isValid?: boolean }>(request);
    if (typeof body.isValid !== "boolean") {
      return errorJson(new Error("有効・無効状態を指定してください。"));
    }
    const vote = await setVoteValidity(eventId, voteId, body.isValid);
    return json({ vote });
  } catch (error) {
    return errorJson(error);
  }
}
