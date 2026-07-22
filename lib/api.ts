export async function readBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function errorJson(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "処理に失敗しました。";
  return json({ error: message }, { status });
}
