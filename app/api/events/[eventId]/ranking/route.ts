import { confirmRanking, saveTieBreak } from "@/lib/data-store";
import { errorJson, json, readBody } from "@/lib/api";
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
    const body = await readBody<{
      voteCount?: number;
      orderedIds?: string[];
    }>(request);

    if (body.orderedIds) {
      const tieBreaks = await saveTieBreak(
        eventId,
        Number(body.voteCount),
        body.orderedIds,
      );
      return json({ tieBreaks });
    }

    const event = await confirmRanking(eventId);
    return json({ event });
  } catch (error) {
    return errorJson(error);
  }
}
