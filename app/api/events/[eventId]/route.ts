import {
  deleteEvent,
  getBundle,
  publicEvent,
  updateEvent,
} from "@/lib/data-store";
import { errorJson, json, readBody } from "@/lib/api";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const bundle = await getBundle(eventId);
    return json({
      event: publicEvent(bundle.event),
      candidates: bundle.candidates,
      votes: bundle.votes,
      tieBreaks: bundle.tieBreaks,
    });
  } catch (error) {
    return errorJson(error, 404);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }

    const { eventId } = await params;
    const body = await readBody<{
      name?: string;
      description?: string;
      password?: string;
      presentationCount?: number;
      voteSelectionCount?: number;
    }>(request);
    const event = await updateEvent(eventId, body);
    return json({ event: publicEvent(event) });
  } catch (error) {
    return errorJson(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }

    const { eventId } = await params;
    await deleteEvent(eventId);
    return json({ ok: true });
  } catch (error) {
    return errorJson(error);
  }
}
