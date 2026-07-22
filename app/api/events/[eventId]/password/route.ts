import { getBundle, verifyPassword } from "@/lib/data-store";
import { errorJson, json, readBody } from "@/lib/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const body = await readBody<{ password?: string }>(request);

    if (!body.password?.trim()) {
      return errorJson(new Error("参加パスワードを入力してください。"), 400);
    }

    const bundle = await getBundle(eventId);
    if (!verifyPassword(body.password, bundle.event.passwordHash)) {
      return errorJson(new Error("参加パスワードが違います。"), 401);
    }

    return json({ ok: true });
  } catch (error) {
    return errorJson(error);
  }
}
