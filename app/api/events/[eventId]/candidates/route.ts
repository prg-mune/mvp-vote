import {
  addCandidate,
  addCandidates,
  getBundle,
  reorderCandidates,
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
      candidates: bundle.candidates.sort(
        (a, b) => a.displayOrder - b.displayOrder,
      ),
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
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }

    const { eventId } = await params;
    const body = await readBody<{
      name?: string;
      description?: string;
      imagePath?: string;
      orderedIds?: string[];
      candidates?: Array<{
        name?: string;
        description?: string;
        imagePath?: string;
      }>;
    }>(request);

    if (body.orderedIds) {
      const candidates = await reorderCandidates(eventId, body.orderedIds);
      return json({ candidates });
    }

    if (body.candidates) {
      const candidates = await addCandidates(
        eventId,
        body.candidates.map((candidate) => ({
          name: candidate.name ?? "",
          description: candidate.description,
          imagePath: candidate.imagePath,
        })),
      );
      return json({ candidates }, { status: 201 });
    }

    if (!body.name?.trim()) {
      return errorJson(new Error("候補者名を入力してください。"));
    }

    const candidate = await addCandidate(eventId, {
      name: body.name,
      description: body.description,
      imagePath: body.imagePath,
    });

    return json({ candidate }, { status: 201 });
  } catch (error) {
    return errorJson(error);
  }
}
