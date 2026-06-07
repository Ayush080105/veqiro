import { requireAdminSession } from "@/lib/server-session";
import { OverviewClient } from "@/components/overview/OverviewClient";

export default async function OverviewPage() {
  await requireAdminSession();
  return <OverviewClient />;
}
