import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin-auth";
import { PresentationPageClient } from "./PresentationPageClient";

export default async function PresentationPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const cookieStore = await cookies();
  const isLoggedIn = verifyAdminSession(
    cookieStore.get(adminSessionCookie)?.value,
  );

  if (!isLoggedIn) {
    redirect("/admin");
  }

  return <PresentationPageClient eventId={eventId} />;
}
