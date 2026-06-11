import { requireAdminSession } from "@/lib/server-session";
import { WaitlistClient } from "@/components/waitlist/WaitlistClient";

export default async function WaitlistPage() {
  await requireAdminSession();
  return <WaitlistClient />;
}
