import { adminSessionCookie } from "@/lib/admin-auth";
import { json } from "@/lib/api";

export async function POST() {
  const response = json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${adminSessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return response;
}
