import type { NextResponse } from "next/server";

export const ACCESS_TOKEN_COOKIE_NAME = "access_token";

export function clearAccessTokenOnNextResponse(res: NextResponse): NextResponse {
	res.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "", {
		httpOnly: true,
		path: "/",
		maxAge: 0,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
	return res;
}
