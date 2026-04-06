import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import type { AccountsApiResponse } from "@/components/dashboard/account/types";
import { getApiBaseUrl } from "@/lib/custom-auth/api";

export type AccountsPageQuery = {
	page: number;
	pageSize: number;
	keyword: string;
};

export type FetchAccountsResult =
	| { ok: true; data: AccountsApiResponse }
	| { ok: false; status: number; detail: string };

async function fetchAccountsWithToken(
	accessToken: string,
	{ page, pageSize, keyword }: AccountsPageQuery
): Promise<FetchAccountsResult> {
	const headers = {
		Authorization: `Bearer ${accessToken}`,
		Accept: "application/json",
	};

	const skip = page * pageSize;

	const currentRes = await fetch(`${getApiBaseUrl()}/api/v1/accounts/me`, {
		method: "GET",
		headers,
		cache: "no-store",
	});

	if (!currentRes.ok) {
		const detail = await currentRes.text();
		return { ok: false, status: currentRes.status, detail: detail || "Unable to fetch current account" };
	}

	const current = (await currentRes.json()) as { id: string; role: string };

	if (current.role === "user_level_2") {
		return { ok: false, status: 403, detail: "User level 2 cannot access the accounts list" };
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
		return { ok: false, status: accountsRes.status, detail: detail || "Unable to fetch accounts" };
	}

	const payload = (await accountsRes.json()) as Record<string, unknown>;

	const data: AccountsApiResponse = {
		current: current as AccountsApiResponse["current"],
		...(payload as Omit<AccountsApiResponse, "current">),
		page,
		pageSize,
	};

	return { ok: true, data };
}

export async function fetchAccountsPageForCurrentSession(query: AccountsPageQuery): Promise<FetchAccountsResult> {
	const cookieStore = await cookies();
	const accessToken = cookieStore.get("access_token")?.value;
	if (!accessToken) {
		return { ok: false, status: 401, detail: "Unauthorized" };
	}
	return fetchAccountsWithToken(accessToken, query);
}

/** Chỉ dùng từ RSC — gộp lần gọi trùng trong cùng một render (vd. Strict Mode). */
export const getAccountsPageForSessionCached = cache(fetchAccountsPageForCurrentSession);
