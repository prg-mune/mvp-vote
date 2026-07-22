import { createHash } from "node:crypto";

export const adminSessionCookie = "mvp_admin_session";

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "preview";
}

export function createAdminSessionToken() {
  return createHash("sha256")
    .update(`mvp-admin:${adminPassword()}`)
    .digest("hex");
}

export function verifyAdminPassword(password: string) {
  return password === adminPassword();
}

export function verifyAdminSession(token?: string) {
  return token === createAdminSessionToken();
}

export function verifyAdminRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${adminSessionCookie}=`))
    ?.split("=")[1];
  return verifyAdminSession(token);
}
