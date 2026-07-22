import { readFile } from "node:fs/promises";
import path from "node:path";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: assetPath } = await params;
  const safePath = assetPath.filter((segment) => segment !== "..");
  const filePath = path.join(process.cwd(), "dist", "client", "assets", ...safePath);
  const extension = path.extname(filePath);

  try {
    const body = await readFile(filePath);

    return new Response(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentTypes[extension] ?? "application/octet-stream",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
