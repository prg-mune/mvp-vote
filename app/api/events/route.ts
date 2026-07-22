import { createEvent, listEvents, publicEvent } from "@/lib/data-store";
import { errorJson, json, readBody } from "@/lib/api";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function GET() {
  try {
    const events = await listEvents();
    return json({ events: events.map(publicEvent) });
  } catch (error) {
    return errorJson(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }

    const body = await readBody<{
      name?: string;
      description?: string;
      password?: string;
      presentationCount?: number;
      voteSelectionCount?: number;
    }>(request);

    if (!body.name?.trim()) {
      return errorJson(new Error("イベント名を入力してください。"));
    }
    if (!body.password?.trim()) {
      return errorJson(new Error("イベント参加パスワードを入力してください。"));
    }

    const event = await createEvent({
      name: body.name,
      description: body.description,
      password: body.password,
      presentationCount: body.presentationCount,
      voteSelectionCount: body.voteSelectionCount,
    });

    return json({ event: publicEvent(event) }, { status: 201 });
  } catch (error) {
    return errorJson(error);
  }
}
