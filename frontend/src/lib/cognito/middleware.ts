import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import * as client from "openid-client";

import { paths } from "@/paths";
import { logger } from "@/lib/default-logger";
import { getAppUrl } from "@/lib/get-app-url";

import { createClientConfig } from "./config";

export async function middleware(req: NextRequest): Promise<NextResponse> {
	const res = NextResponse.next({ request: req });

	if (req.nextUrl.pathname.startsWith("/dashboard")) {
		const config = await createClientConfig();
		const sub = req.cookies.get("sub")?.value;
		const accessToken = req.cookies.get("access_token")?.value;

		let user: client.UserInfoResponse | undefined;

		if (sub && accessToken) {
			user = await client.fetchUserInfo(config, accessToken, sub);
		}

		if (!user) {
			logger.debug("[Middleware] User is not logged in, redirecting to sign in");
			const redirectTo = new URL(paths.auth.cognito.signIn, getAppUrl());
			return NextResponse.redirect(redirectTo);
		}
	}

	return res;
}
