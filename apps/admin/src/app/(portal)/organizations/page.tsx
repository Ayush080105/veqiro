import { requireAdminSession } from "@/lib/server-session";
import { OrgsClient } from "@/components/orgs/OrgsClient";
import { Suspense } from "react";

export default async function OrgsPage() {
  await requireAdminSession();
  return (
    <Suspense>
      <OrgsClient />
    </Suspense>
  );
}
