import { NextResponse } from "next/server";

import { paths } from "@/paths";
import { getAppUrl } from "@/lib/get-app-url";

export async function GET(): Promise<NextResponse> {
	const res = new NextResponse(undefined, { status: 307 });

	res.cookies.set("access_token", "", {
		httpOnly: true,
		path: "/",
		maxAge: 0,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
	const signIn = new URL(paths.login, getAppUrl());
	res.headers.set("Location", signIn.toString());

	return res;
}

