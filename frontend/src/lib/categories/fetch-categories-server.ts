import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import type { CategoriesApiResponse } from "@/components/dashboard/category/types";
import { getApiBaseUrl } from "@/lib/custom-auth/api";

export type CategoriesPageQuery = {
	/** null = loại gốc */
	parentId: string | null;
	page: number;
	pageSize: number;
	keyword: string;
};

export type FetchCategoriesResult =
	| { ok: true; data: CategoriesApiResponse }
	| { ok: false; status: number; detail: string };

export async function fetchCategoriesPageForCurrentSession(
	query: CategoriesPageQuery
): Promise<FetchCategoriesResult> {
	const cookieStore = await cookies();
	const accessToken = cookieStore.get("access_token")?.value;
	if (!accessToken) {
		return { ok: false, status: 401, detail: "Unauthorized" };
	}

	const headers = {
		Authorization: `Bearer ${accessToken}`,
		Accept: "application/json",
	};

	const skip = query.page * query.pageSize;
	const url = new URL(`${getApiBaseUrl()}/api/v1/categories/`);
	if (query.parentId) {
		url.searchParams.set("parent_id", query.parentId);
	}
	url.searchParams.set("skip", String(skip));
	url.searchParams.set("limit", String(query.pageSize));
	if (query.keyword) {
		url.searchParams.set("keyword", query.keyword);
	}

	const res = await fetch(url.toString(), { headers, cache: "no-store" });
	if (!res.ok) {
		const detail = await res.text();
		return { ok: false, status: res.status, detail: detail || "Unable to fetch categories" };
	}

	const payload = (await res.json()) as Record<string, unknown>;
	const data: CategoriesApiResponse = {
		data: (payload.data as CategoriesApiResponse["data"]) ?? [],
		count: typeof payload.count === "number" ? payload.count : 0,
		page: query.page,
		pageSize: query.pageSize,
	};

	return { ok: true, data };
}

export const getCategoriesPageForSessionCached = cache(fetchCategoriesPageForCurrentSession);
