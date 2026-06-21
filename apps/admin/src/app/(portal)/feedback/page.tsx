import { requireAdminSession } from "@/lib/server-session";
import { FeedbackClient } from "@/components/feedback/FeedbackClient";

export default async function FeedbackPage() {
  await requireAdminSession();
  return <FeedbackClient />;
}
