import "server-only";

import { cookies } from "next/headers";

import { user } from "./data";
import type { User } from "./types";

export async function getUser(): Promise<{ data?: { user: User | null }; error?: string }> {
	const cookieStore = await cookies();
	const token = cookieStore.get("access_token");

	if (!token) {
		return { data: { user: null } };
	}

	return { data: { user } };
}
