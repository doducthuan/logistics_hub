import { paths } from "@/paths";

import type { User } from "./types";

export async function getUser(): Promise<{ data?: { user: User | null }; error?: string }> {
	const res = await fetch(paths.auth.custom.profile);
	const data = (await res.json()) as { user: User | null };

	return { data: { user: data.user } };
}
