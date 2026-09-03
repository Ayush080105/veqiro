"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- checked-in CommonJS mirror of server-session.ts */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSession = requireSession;
exports.getSession = getSession;
require("server-only");
const react_1 = require("react");
const headers_1 = require("next/headers");
const navigation_1 = require("next/navigation");
// Fetches the Better Auth session over HTTP, forwarding the browser cookies.
// Importing the server's `auth` directly doesn't work here — the server uses
// Node ESM `.js` import extensions that Next's webpack cannot resolve.
const fetchSession = (0, react_1.cache)(async () => {
    const forwarded = await (0, headers_1.headers)();
    const ua = forwarded.get("user-agent") ?? "";
    // Use the raw Cookie header so nothing is lost in parse/re-serialize
    const rawCookieHeader = forwarded.get("cookie") ?? "";
    try {
        const res = await fetch(`${process.env.BACKEND_URL}/api/v1/auth/get-session`, {
            headers: {
                cookie: rawCookieHeader,
                "user-agent": ua,
            },
            cache: "no-store",
        });
        if (!res.ok)
            return null;
        const body = (await res.json());
        if (!body || !body.user)
            return null;
        return body;
    }
    catch {
        return null;
    }
});
async function requireSession() {
    const sess = await fetchSession();
    if (!sess?.user) {
        (0, navigation_1.redirect)("/login");
    }
    const activeOrganizationId = sess.session?.activeOrganizationId ?? null;
    if (!activeOrganizationId) {
        (0, navigation_1.redirect)("/workspaces");
    }
    return {
        userId: sess.user.id,
        userName: sess.user.name,
        userEmail: sess.user.email,
        userImage: sess.user.image ?? null,
        activeOrganizationId,
    };
}
async function getSession() {
    return fetchSession();
}
