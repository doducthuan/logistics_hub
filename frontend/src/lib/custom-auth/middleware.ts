import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { paths } from "@/paths";
import { logger } from "@/lib/default-logger";
import { getAppUrl } from "@/lib/get-app-url";

import { getUser } from "./server";

export async function middleware(req: NextRequest): Promise<NextResponse> {
	const res = NextResponse.next({ request: req });

	if (req.nextUrl.pathname.startsWith("/dashboard")) {
		const { data } = await getUser();

		if (!data?.user) {
			logger.debug("[Middleware] User is not logged in, redirecting to sign in");
			const redirectTo = new URL(paths.auth.custom.signIn, getAppUrl());
			return NextResponse.redirect(redirectTo);
		}
	}

	return res;
}
