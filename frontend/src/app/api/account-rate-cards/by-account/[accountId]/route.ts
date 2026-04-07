import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/custom-auth/api";

async function getAccessToken(): Promise<string | null> {
	const cookieStore = await cookies();
	return cookieStore.get("access_token")?.value ?? null;
}

export async function GET(
	_request: Request,
	context: { params: Promise<{ accountId: string }> }
): Promise<NextResponse> {
	const accessToken = await getAccessToken();
	if (!accessToken) {
		return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
	}

	const { accountId } = await context.params;
	const response = await fetch(`${getApiBaseUrl()}/api/v1/account-rate-cards/by-account/${encodeURIComponent(accountId)}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
		},
		cache: "no-store",
	});

	const data = (await response.json().catch(() => ({}))) as unknown;
	return NextResponse.json(data, { status: response.status });
}
