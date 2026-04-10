import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { fetchAccountsPageForCurrentSession } from "@/lib/accounts/fetch-accounts-server";
import { clearAccessTokenOnNextResponse } from "@/lib/custom-auth/access-token-cookie";
import { getApiBaseUrl } from "@/lib/custom-auth/api";

async function getAccessToken(): Promise<string | null> {
	const cookieStore = await cookies();
	return cookieStore.get("access_token")?.value ?? null;
}

function unauthorizedResponse(): NextResponse {
	return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request): Promise<NextResponse> {
	const url = new URL(request.url);
	const page = Math.max(0, Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
	const pageSize = Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10) || 10);
	const keyword = url.searchParams.get("keyword")?.trim() ?? "";

	const result = await fetchAccountsPageForCurrentSession({ page, pageSize, keyword });

	if (!result.ok) {
		if (result.status === 404 || result.status === 401) {
			const res = NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
			return clearAccessTokenOnNextResponse(res);
		}
		return NextResponse.json({ detail: result.detail }, { status: result.status });
	}

	return NextResponse.json(result.data);
}

export async function POST(request: Request): Promise<NextResponse> {
	const accessToken = await getAccessToken();

	if (!accessToken) {
		return unauthorizedResponse();
	}

	const meHeaders = {
		Authorization: `Bearer ${accessToken}`,
		Accept: "application/json",
	};
	const currentRes = await fetch(`${getApiBaseUrl()}/api/v1/accounts/me`, {
		method: "GET",
		headers: meHeaders,
		cache: "no-store",
	});
	if (!currentRes.ok) {
		if (currentRes.status === 404 || currentRes.status === 401) {
			const res = NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
			return clearAccessTokenOnNextResponse(res);
		}
		const detail = await currentRes.text();
		return NextResponse.json({ detail: detail || "Unable to fetch current account" }, { status: currentRes.status });
	}
	const current = (await currentRes.json()) as { role: string };
	if (current.role === "user_level_2") {
		return NextResponse.json({ detail: "Not enough permissions" }, { status: 403 });
	}

	const body = (await request.json()) as unknown;

	const response = await fetch(`${getApiBaseUrl()}/api/v1/accounts/`, {
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
