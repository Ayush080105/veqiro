import { requireAdminSession } from "@/lib/server-session";
import { ActivityClient } from "@/components/activity/ActivityClient";

export default async function ActivityPage() {
  await requireAdminSession();
  return <ActivityClient />;
}
