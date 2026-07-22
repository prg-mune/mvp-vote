import { readEventAsset } from "@/lib/data-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; fileName: string }> },
) {
  try {
    const { eventId, fileName } = await params;
    const asset = await readEventAsset(eventId, fileName);

    return new Response(asset.body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": asset.contentType,
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
