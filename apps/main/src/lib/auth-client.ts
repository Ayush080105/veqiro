import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins"
import { dodopaymentsClient } from "@dodopayments/better-auth"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  basePath: `/api/${process.env.NEXT_PUBLIC_API_VERSION! || "v1"}/auth`,
  // Caching strategy:
  //  - The session is held in better-auth's nanostore cache, so multiple
  //    `useSession()` callers in the same render share one fetch.
  //  - We disable window-focus refetching to avoid hammering /get-session
  //    every time the user tabs away and back. The proxy middleware is the
  //    authoritative gate on hard navigations and explicit calls to
  //    `authClient.getSession({ query: { disableCookieCache: true } })`
  //    (e.g. the onboarding finalize flow) still bypass this.
  sessionOptions: {
    refetchOnWindowFocus: false,
  },
  plugins: [
    organizationClient({
      schema: {
        organization: {
          additionalFields: {
            onboarded: {
              type: "boolean",
              defaultValue: false,
            },
          },
        },
      },
    }),
    dodopaymentsClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
