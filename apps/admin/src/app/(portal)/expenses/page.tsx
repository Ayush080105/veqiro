import { requireAdminSession } from "@/lib/server-session";
import { GroupsClient } from "@/components/expenses/GroupsClient";

export default async function ExpensesPage() {
  await requireAdminSession();
  return <GroupsClient />;
}
