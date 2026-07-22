import { getBundle, publicEvent, setPresentationState } from "@/lib/data-store";
import { errorJson, json, readBody } from "@/lib/api";
import { verifyAdminRequest } from "@/lib/admin-auth";
import type { PresentationPhase } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }
    const { eventId } = await params;
    const bundle = await getBundle(eventId);
    return json({
      event: publicEvent(bundle.event),
      presentationState: bundle.event.presentationState,
    });
  } catch (error) {
    return errorJson(error, 404);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const body = await readBody<{
      phase?: PresentationPhase;
      currentRank?: number;
    }>(request);
    if (!body.phase) {
      return errorJson(new Error("発表状態を指定してください。"));
    }
    const presentationState = await setPresentationState(
      eventId,
      body.phase,
      body.currentRank,
    );
    return json({ presentationState });
  } catch (error) {
    return errorJson(error);
  }
}
