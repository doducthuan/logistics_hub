import "server-only";

import { cookies } from "next/headers";

import { fetchAccountByAccessToken, mapAccountToUser } from "./api";
import type { User } from "./types";

export async function getUser(): Promise<{ data?: { user: User | null }; error?: string }> {
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
