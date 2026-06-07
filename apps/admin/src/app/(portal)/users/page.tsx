import { requireAdminSession } from "@/lib/server-session";
import { UsersClient } from "@/components/users/UsersClient";

export default async function UsersPage() {
  await requireAdminSession();
  return <UsersClient />;
}
