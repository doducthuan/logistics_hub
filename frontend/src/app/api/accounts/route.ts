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

export async function GET(request: Request): Promise<NextResponse> {
	const accessToken = await getAccessToken();

	if (!accessToken) {
		return unauthorizedResponse();
	}

	const headers = {
		Authorization: `Bearer ${accessToken}`,
		Accept: "application/json",
	};

	const url = new URL(request.url);
	const page = Math.max(0, Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
	const pageSize = Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10) || 10);
	const keyword = url.searchParams.get("keyword")?.trim() ?? "";
	const skip = page * pageSize;

	// Lấy user hiện tại từ JWT (cùng vai trò với test-token, nhưng dùng GET REST chuẩn hơn)
	const currentRes = await fetch(`${getApiBaseUrl()}/api/v1/accounts/me`, {
		method: "GET",
		headers,
		cache: "no-store",
	});

	if (!currentRes.ok) {
		const detail = await currentRes.text();
		return NextResponse.json({ detail: detail || "Unable to fetch current account" }, { status: currentRes.status });
	}

	const current = (await currentRes.json()) as { id: string; role: string };

	if (current.role === "user_level_2") {
		return NextResponse.json(
			{ detail: "User level 2 cannot access the accounts list" },
			{ status: 403 },
		);
	}

	const accountsUrl = new URL(`${getApiBaseUrl()}/api/v1/accounts/`);
	accountsUrl.searchParams.set("parent_id", current.id);
	accountsUrl.searchParams.set("skip", String(skip));
	accountsUrl.searchParams.set("limit", String(pageSize));
	if (keyword) {
		accountsUrl.searchParams.set("keyword", keyword);
	}

	const accountsRes = await fetch(accountsUrl.toString(), { headers, cache: "no-store" });

	if (!accountsRes.ok) {
		const detail = await accountsRes.text();
		return NextResponse.json({ detail: detail || "Unable to fetch accounts" }, { status: accountsRes.status });
	}

	const payload = (await accountsRes.json()) as Record<string, unknown>;

	return NextResponse.json({
		current,
		...payload,
		page,
		pageSize,
	});
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
