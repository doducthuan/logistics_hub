import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearAccessTokenOnNextResponse } from "@/lib/custom-auth/access-token-cookie";
import { getApiBaseUrl } from "@/lib/custom-auth/api";

async function getAccessToken(): Promise<string | null> {
	const cookieStore = await cookies();
	return cookieStore.get("access_token")?.value ?? null;
}

export async function GET(
	_request: Request,
	context: { params: Promise<{ accountId: string; categoryId: string }> }
): Promise<NextResponse> {
	const accessToken = await getAccessToken();
	if (!accessToken) {
		return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
	}

	const { accountId, categoryId } = await context.params;
	const url = `${getApiBaseUrl()}/api/v1/account-rate-cards/by-account/${encodeURIComponent(accountId)}/category/${encodeURIComponent(categoryId)}/history`;
	const response = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
		},
		cache: "no-store",
	});

	const data = (await response.json().catch(() => ({}))) as unknown;
	if (response.status === 401) {
		const res = NextResponse.json(data, { status: 401 });
		return clearAccessTokenOnNextResponse(res);
	}
	return NextResponse.json(data, { status: response.status });
}
