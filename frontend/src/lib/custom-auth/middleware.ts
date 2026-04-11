import { NextResponse, type NextRequest } from "next/server";

import { paths } from "@/paths";
import { clearAccessTokenOnNextResponse } from "@/lib/custom-auth/access-token-cookie";
import { fetchAccountMe, validateAccessToken } from "@/lib/custom-auth/api";
import { hasJwtSecretConfigured, isJwtAccessTokenValid } from "@/lib/custom-auth/jwt-verify";

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
	if (p === paths.setNewPassword) return true;
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

	if (hasJwtSecretConfigured()) {
		const jwtOk = await isJwtAccessTokenValid(token);
		if (!jwtOk) {
			return redirectToLogin(req);
		}
		/* JWT còn hạn nhưng tài khoản có thể đã xóa — GET /me 404/401 phải hủy phiên. */
		const me = await fetchAccountMe(token);
		if (!me.ok) {
			if (me.status === 404 || me.status === 401) {
				return redirectToLogin(req);
			}
			return NextResponse.next({ request: req });
		}
		return NextResponse.next({ request: req });
	}

	const valid = await validateAccessToken(token);
	if (!valid) {
		return redirectToLogin(req);
	}

	return NextResponse.next({ request: req });
}

function redirectToLogin(req: NextRequest): NextResponse {
	const loginUrl = new URL(paths.login, req.url);
	const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
	if (returnTo !== paths.login && returnTo !== paths.home) {
		loginUrl.searchParams.set("callbackUrl", returnTo);
	}
	const res = NextResponse.redirect(loginUrl);
	return clearAccessTokenOnNextResponse(res);
}
