import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:5000",
  basePath: `/api/${process.env.NEXT_PUBLIC_API_VERSION ?? "v1"}/auth`,
  plugins: [adminClient()],
});

export const { signIn, signOut, useSession } = authClient;
