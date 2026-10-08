/** The ways to connect HubSpot, and which of them a workspace is offered. No imports on purpose, so it is easy to test. */

export type ConnectMethod = "oauth" | "service-key" | "private-app"

export const METHOD_LABEL: Record<ConnectMethod, string> = {
  oauth: "Connect with HubSpot",
  "service-key": "Service Key",
  "private-app": "Private app token",
}

/**
 * "Connect with HubSpot" (one click) needs the server to have a registered HubSpot app, so it is only
 * offered, and only the default, once the server says it is ready. The key-based ways always work.
 */
export function availableMethods(oauthAvailable: boolean): ConnectMethod[] {
  return oauthAvailable ? ["oauth", "service-key", "private-app"] : ["service-key", "private-app"]
}

/** The method to show: the person's pick if it is still offered, otherwise the first one offered. */
export function currentMethod(picked: ConnectMethod | null, oauthAvailable: boolean): ConnectMethod {
  const methods = availableMethods(oauthAvailable)
  return picked && methods.includes(picked) ? picked : methods[0]!
}
