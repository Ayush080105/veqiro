import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  basePath: `/api/${process.env.NEXT_PUBLIC_API_VERSION! || "v1"}/auth`,
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
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;

