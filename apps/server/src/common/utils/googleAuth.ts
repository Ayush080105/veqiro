import { prisma } from "../../config/prisma.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export class GoogleNotConnectedError extends Error {
  constructor() {
    super(
      "Google account not connected. Sign in with Google (with Gmail + Calendar scopes) first."
    );
    this.name = "GoogleNotConnectedError";
  }
}

const findGoogleAccount = (userId: string) =>
  prisma.account.findFirst({
    where: { userId, providerId: "google" },
    orderBy: { updatedAt: "desc" },
  });

const refreshAccessToken = async (
  accountId: string,
  refreshToken: string
): Promise<GoogleTokens> => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${err}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };
  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000)
    : null;
  const updated = await prisma.account.update({
    where: { id: accountId },
    data: {
      accessToken: json.access_token,
      accessTokenExpiresAt: expiresAt ?? undefined,
      refreshToken: json.refresh_token ?? undefined,
    },
  });
  return {
    accessToken: updated.accessToken!,
    refreshToken: updated.refreshToken,
    expiresAt: updated.accessTokenExpiresAt,
  };
};

export const getGoogleAccessToken = async (userId: string): Promise<string> => {
  const account = await findGoogleAccount(userId);
  if (!account || !account.accessToken) {
    throw new GoogleNotConnectedError();
  }

  // Refresh if expired or within 60s of expiry and we have a refresh token
  const expiresAt = account.accessTokenExpiresAt;
  const isExpiring =
    expiresAt !== null && expiresAt.getTime() - Date.now() < 60_000;

  if (isExpiring && account.refreshToken) {
    try {
      const fresh = await refreshAccessToken(account.id, account.refreshToken);
      return fresh.accessToken;
    } catch (err) {
      console.error("[google] refresh failed, using existing token", err);
    }
  }

  return account.accessToken;
};
