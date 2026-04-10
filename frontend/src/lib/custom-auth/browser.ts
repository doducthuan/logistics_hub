import { paths } from "@/paths";

import type { User } from "./types";

let inflightProfileRequest: Promise<{ data?: { user: User | null }; error?: string }> | null = null;

/**
 * Gộp các fetch profile song song (ví dụ React Strict Mode gọi effect hai lần trong dev).
 */
export async function getUser(): Promise<{ data?: { user: User | null }; error?: string }> {
	if (inflightProfileRequest) {
		return inflightProfileRequest;
	}
	inflightProfileRequest = (async () => {
		try {
			const res = await fetch(paths.auth.custom.profile, {
				credentials: "same-origin",
				cache: "no-store",
			});
			if (res.status === 401) {
				globalThis.location.assign(paths.login);
				return { data: { user: null } };
			}
			if (!res.ok) {
				return { data: { user: null }, error: "Failed to load profile" };
			}
			const data = (await res.json()) as { user: User | null };
			return { data: { user: data.user } };
		} finally {
			inflightProfileRequest = null;
		}
	})();
	return inflightProfileRequest;
}

/** BFF đã xóa cookie khi /me 404/401 — đưa user về login thay vì để UI kẹt. */
export function redirectToLoginIfUnauthorized(res: Response): boolean {
	if (res.status === 401) {
		globalThis.location.assign(paths.login);
		return true;
	}
	return false;
}
