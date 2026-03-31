import { NextResponse } from "next/server";

import { getAppUrl } from "@/lib/get-app-url";

export async function GET(): Promise<NextResponse> {
	const res = new NextResponse(undefined, { status: 307 });

	// Cleanup tokens
	res.cookies.delete("access_token");
	res.headers.set("Location", getAppUrl().toString());

	return res;
}
