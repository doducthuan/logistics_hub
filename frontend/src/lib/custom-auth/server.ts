import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { fetchAccountByAccessToken, mapAccountToUser } from "./api";
import type { User } from "./types";

async function getUserUncached(): Promise<{ data?: { user: User | null }; error?: string }> {
	const cookieStore = await cookies();
	const token = cookieStore.get("access_token");

	if (!token?.value) {
		return { data: { user: null } };
	}

	try {
		const account = await fetchAccountByAccessToken(token.value);
		if (!account) {
			return { data: { user: null } };
		}
		return { data: { user: mapAccountToUser(account) } };
	} catch {
		return { data: { user: null }, error: "Failed to validate session" };
	}
}

/** Gộp các lần gọi trong cùng một request RSC (kể cả Strict Mode dev). */
export const getUser = cache(getUserUncached);
