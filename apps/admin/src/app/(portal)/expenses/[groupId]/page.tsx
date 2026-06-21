import { requireAdminSession } from "@/lib/server-session";
import { GroupDetailClient } from "@/components/expenses/GroupDetailClient";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  await requireAdminSession();
  const { groupId } = await params;
  return <GroupDetailClient groupId={groupId} />;
}
