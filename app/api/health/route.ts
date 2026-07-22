import { json } from "@/lib/api";

export async function GET() {
  return json({
    ok: true,
    service: "mvp-voting-app",
    checkedAt: new Date().toISOString(),
  });
}
