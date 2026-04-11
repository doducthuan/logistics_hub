import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearAccessTokenOnNextResponse } from "@/lib/custom-auth/access-token-cookie";
import { getApiBaseUrl } from "@/lib/custom-auth/api";

async function getAccessToken(): Promise<string | null> {
	const cookieStore = await cookies();
	return cookieStore.get("access_token")?.value ?? null;
}

/**
 * Danh sách User cấp 2 do một User cấp 1 quản lý (chỉ admin).
 * Query: parentId, page, pageSize, keyword (tùy chọn).
 */
export async function GET(request: Request): Promise<NextResponse> {
	const accessToken = await getAccessToken();

	if (!accessToken) {
		return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
	}

	const headers = {
		Authorization: `Bearer ${accessToken}`,
		Accept: "application/json",
	};

	const meRes = await fetch(`${getApiBaseUrl()}/api/v1/accounts/me`, {
		method: "GET",
		headers,
		cache: "no-store",
	});

	if (!meRes.ok) {
		if (meRes.status === 404 || meRes.status === 401) {
			const res = NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
			return clearAccessTokenOnNextResponse(res);
		}
		const detail = await meRes.text();
		return NextResponse.json({ detail: detail || "Unable to fetch current account" }, { status: meRes.status });
	}

	const me = (await meRes.json()) as { role: string };
	if (me.role !== "admin") {
		return NextResponse.json({ detail: "Not enough permissions" }, { status: 403 });
	}

	const url = new URL(request.url);
	const parentId = url.searchParams.get("parentId")?.trim();
	if (!parentId) {
		return NextResponse.json({ detail: "parentId is required" }, { status: 400 });
	}

	const page = Math.max(0, Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
	const pageSize = Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10) || 10);
	const keyword = url.searchParams.get("keyword")?.trim() ?? "";
	const skip = page * pageSize;

	const accountsUrl = new URL(`${getApiBaseUrl()}/api/v1/accounts/`);
	accountsUrl.searchParams.set("parent_id", parentId);
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
		...payload,
		page,
		pageSize,
	});
}
