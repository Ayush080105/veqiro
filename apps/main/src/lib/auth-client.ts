import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins"
import { dodopaymentsClient } from "@dodopayments/better-auth"

export const authClient = createAuthClient({
  baseURL:  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:5000",
  basePath: `/api/${process.env.NEXT_PUBLIC_API_VERSION || "v1"}/auth`,
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
