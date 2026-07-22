import { deleteCandidate, updateCandidate } from "@/lib/data-store";
import { errorJson, json, readBody } from "@/lib/api";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; candidateId: string }> },
) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }

    const { eventId, candidateId } = await params;
    const body = await readBody<{
      name?: string;
      description?: string;
      imagePath?: string;
    }>(request);
    const candidate = await updateCandidate(eventId, candidateId, body);
    return json({ candidate });
  } catch (error) {
    return errorJson(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string; candidateId: string }> },
) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }

    const { eventId, candidateId } = await params;
    const candidates = await deleteCandidate(eventId, candidateId);
    return json({ candidates });
  } catch (error) {
    return errorJson(error);
  }
}
