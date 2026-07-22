import { castVote, getBundle } from "@/lib/data-store";
import { errorJson, json, readBody } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const bundle = await getBundle(eventId);
    const candidatesById = new Map(
      bundle.candidates.map((candidate) => [candidate.id, candidate]),
    );
    return json({
      votes: bundle.votes.map((vote) => ({
        ...vote,
        candidates: vote.candidateIds.map((candidateId) =>
          candidatesById.get(candidateId),
        ),
      })),
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
      password?: string;
      browserId?: string;
      nickname?: string;
      candidateId?: string;
      candidateIds?: string[];
    }>(request);

    const candidateIds = body.candidateIds ?? (body.candidateId ? [body.candidateId] : []);

    if (!body.password || !body.browserId || !body.nickname || candidateIds.length === 0) {
      return errorJson(new Error("投票に必要な情報が不足しています。"));
    }

    const vote = await castVote(eventId, {
      password: body.password,
      browserId: body.browserId,
      nickname: body.nickname,
      candidateIds,
    });

    return json({ vote });
  } catch (error) {
    return errorJson(error);
  }
}
