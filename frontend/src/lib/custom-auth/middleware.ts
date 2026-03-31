import { NextResponse, type NextRequest } from "next/server";

import { paths } from "@/paths";
import { validateAccessToken } from "@/lib/custom-auth/api";

function normalizePath(pathname: string): string {
	if (pathname.length > 1 && pathname.endsWith("/")) {
		return pathname.slice(0, -1);
	}
	return pathname;
}

function isPublicPath(pathname: string): boolean {
	const p = normalizePath(pathname);

	if (p === paths.home) return true;
	if (p === paths.login) return true;
	if (p === paths.forgotPassword) return true;
	if (p === paths.auth.custom.profile) return true;
	if (p === paths.auth.custom.resetPassword) return true;
	if (p === paths.auth.custom.signOut) return true;
	if (p.startsWith("/errors/")) return true;

	return false;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
	const pathname = normalizePath(req.nextUrl.pathname);

	if (pathname === paths.auth.custom.signIn) {
		return NextResponse.redirect(new URL(paths.login, req.url));
	}

	if (isPublicPath(pathname)) {
		return NextResponse.next({ request: req });
	}

	const token = req.cookies.get("access_token")?.value;

	if (!token) {
		return redirectToLogin(req);
	}

	const valid = await validateAccessToken(token);
	if (!valid) {
		const res = redirectToLogin(req);
		res.cookies.set("access_token", "", {
			httpOnly: true,
			path: "/",
			maxAge: 0,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
		});
		return res;
	}

	return NextResponse.next({ request: req });
}

function redirectToLogin(req: NextRequest): NextResponse {
	const loginUrl = new URL(paths.login, req.url);
	const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
	if (returnTo !== paths.login && returnTo !== paths.home) {
		loginUrl.searchParams.set("callbackUrl", returnTo);
	}
	return NextResponse.redirect(loginUrl);
}
