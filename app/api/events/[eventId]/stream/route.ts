import { getBundle, getResults, publicEvent } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const encoder = new TextEncoder();
  let lastPayload = "";

  async function buildPayload() {
    const [bundle, results] = await Promise.all([
      getBundle(eventId),
      getResults(eventId),
    ]);
    const validVoteCount = bundle.votes.filter((vote) => vote.isValid).length;
    const invalidVoteCount = bundle.votes.filter((vote) => !vote.isValid).length;

    return JSON.stringify({
      event: publicEvent(bundle.event),
      results,
      counts: {
        validVoteCount,
        invalidVoteCount,
        totalVoteCount: bundle.votes.length,
      },
    });
  }

  let isClosed = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  function closeStream(controller?: ReadableStreamDefaultController<Uint8Array>) {
    isClosed = true;
    if (timer) clearInterval(timer);
    if (!controller) return;
    try {
      controller.close();
    } catch {
      // The client may already have closed the stream.
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      function safeEnqueue(payload: string) {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closeStream();
        }
      }

      async function pushState(force = false) {
        if (isClosed) return;
        try {
          const payload = await buildPayload();
          if (isClosed) return;
          if (force || payload !== lastPayload) {
            lastPayload = payload;
            safeEnqueue(`event: state\ndata: ${payload}\n\n`);
          } else {
            safeEnqueue(": keep-alive\n\n");
          }
        } catch (error) {
          if (isClosed) return;
          const message =
            error instanceof Error ? error.message : "発表状態を取得できませんでした。";
          safeEnqueue(
            `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`,
          );
        }
      }

      await pushState(true);
      timer = setInterval(() => void pushState(), 1000);
      request.signal.addEventListener("abort", () => {
        closeStream(controller);
      });
    },
    cancel() {
      closeStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
