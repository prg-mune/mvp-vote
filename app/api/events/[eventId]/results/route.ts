import { getBundle, getResults, publicEvent } from "@/lib/data-store";
import { errorJson, json } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const [bundle, results] = await Promise.all([
      getBundle(eventId),
      getResults(eventId),
    ]);
    const validVoteCount = bundle.votes.filter((vote) => vote.isValid).length;
    const invalidVoteCount = bundle.votes.filter((vote) => !vote.isValid).length;

    return json({
      event: publicEvent(bundle.event),
      results,
      counts: {
        validVoteCount,
        invalidVoteCount,
        totalVoteCount: bundle.votes.length,
      },
    });
  } catch (error) {
    return errorJson(error, 404);
  }
}
