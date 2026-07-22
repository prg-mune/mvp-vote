import { saveEventAsset } from "@/lib/data-store";
import { errorJson, json } from "@/lib/api";
import { verifyAdminRequest } from "@/lib/admin-auth";

const maxUploadBytes = 5 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }

    const { eventId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return errorJson(new Error("画像ファイルを選択してください。"), 400);
    }
    if (file.size <= 0) {
      return errorJson(new Error("空の画像ファイルは登録できません。"), 400);
    }
    if (file.size > maxUploadBytes) {
      return errorJson(new Error("画像ファイルは5MB以下にしてください。"), 400);
    }

    const body = Buffer.from(await file.arrayBuffer());
    const asset = await saveEventAsset(eventId, {
      fileName: file.name,
      contentType: file.type,
      body,
    });

    return json({ asset });
  } catch (error) {
    return errorJson(error);
  }
}
