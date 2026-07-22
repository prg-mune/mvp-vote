import {
  adminSessionCookie,
  createAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { errorJson, json, readBody } from "@/lib/api";

export async function POST(request: Request) {
  const body = await readBody<{ password?: string }>(request);

  if (!body.password || !verifyAdminPassword(body.password)) {
    return errorJson(new Error("管理者パスワードが違います。"), 401);
  }

  const response = json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${adminSessionCookie}=${createAdminSessionToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`,
  );
  return response;
}
