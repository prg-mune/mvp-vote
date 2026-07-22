import { getBundle, rankCandidates } from "@/lib/data-store";
import { errorJson } from "@/lib/api";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    if (!verifyAdminRequest(request)) {
      return errorJson(new Error("管理者ログインが必要です。"), 401);
    }

    const { eventId } = await params;
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "votes";
    const bundle = await getBundle(eventId);
    const candidatesById = new Map(
      bundle.candidates.map((candidate) => [candidate.id, candidate]),
    );

    if (type === "results") {
      const rows = [
        ["順位", "候補者名", "得票数", "発表対象かどうか"],
        ...rankCandidates(bundle).map((candidate) => [
          String(candidate.rank),
          candidate.name,
          String(candidate.votes),
          candidate.isPresentationTarget ? "対象" : "対象外",
        ]),
      ];
      return csvResponse(rows, `${bundle.event.name}-集計.csv`);
    }

    const rows = [
      [
        "イベント名",
        "ニックネーム",
        "投票先候補者名",
        "投票日時",
        "最終変更日時",
        "有効・無効状態",
        "無効化日時",
      ],
      ...bundle.votes.map((vote) => [
        bundle.event.name,
        vote.nickname,
        vote.candidateIds
          .map((candidateId) => candidatesById.get(candidateId)?.name)
          .filter(Boolean)
          .join("、"),
        vote.votedAt,
        vote.updatedAt,
        vote.isValid ? "有効" : "無効",
        vote.invalidatedAt ?? "",
      ]),
    ];
    return csvResponse(rows, `${bundle.event.name}-投票一覧.csv`);
  } catch (error) {
    return errorJson(error);
  }
}

function csvResponse(rows: string[][], filename: string) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  return new Response(`\uFEFF${csv}\r\n`, {
    headers: {
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
