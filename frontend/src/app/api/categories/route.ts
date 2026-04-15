import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { fetchCategoriesPageForCurrentSession } from "@/lib/categories/fetch-categories-server";
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
	const parentIdRaw = url.searchParams.get("parentId")?.trim();
	const parentId = parentIdRaw && parentIdRaw.length > 0 ? parentIdRaw : null;
	const page = Math.max(0, Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
	const pageSize = Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10) || 10);
	const keyword = url.searchParams.get("keyword")?.trim() ?? "";

	const result = await fetchCategoriesPageForCurrentSession({ parentId, page, pageSize, keyword });

	if (!result.ok) {
		if (result.status === 401) {
			const res = NextResponse.json({ detail: result.detail }, { status: 401 });
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

	const body = (await request.json()) as unknown;

	const response = await fetch(`${getApiBaseUrl()}/api/v1/categories/`, {
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
	if (response.status === 401) {
		const res = NextResponse.json(data, { status: 401 });
		return clearAccessTokenOnNextResponse(res);
	}
	return NextResponse.json(data, { status: response.status });
}
