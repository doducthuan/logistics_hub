import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/custom-auth/api";

async function getAccessToken(): Promise<string | null> {
	const cookieStore = await cookies();
	return cookieStore.get("access_token")?.value ?? null;
}

function unauthorizedResponse(): NextResponse {
	return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request): Promise<NextResponse> {
	const accessToken = await getAccessToken();
	if (!accessToken) {
		return unauthorizedResponse();
	}

	const body = (await request.json()) as unknown;
	const response = await fetch(`${getApiBaseUrl()}/api/v1/account-rate-cards/`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(body),
		cache: "no-store",
	});
	const data = (await response.json().catch(() => ({}))) as unknown;
	return NextResponse.json(data, { status: response.status });
}
