/**
 * Backend API helpers for custom auth (no "server-only" — safe for Edge middleware).
 */

import type { AccountRole, User } from "./types";

export interface AccountPublicResponse {
	id: string;
	email: string;
	full_name: string;
	role: string;
	is_active: boolean;
	phone?: string | null;
	description?: string | null;
	parent_id?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	last_login_at?: string | null;
}

function formatErrorDetail(detail: unknown): string {
	if (typeof detail === "string") {
		return detail;
	}
	if (Array.isArray(detail)) {
		const s = detail
			.map((d) =>
				d && typeof d === "object" && "msg" in d && typeof (d as { msg?: string }).msg === "string"
					? (d as { msg: string }).msg
					: null
			)
			.filter(Boolean)
			.join(", ");
		return s || "Email hoặc mật khẩu không chính xác";
	}
	return "Email hoặc mật khẩu không chính xác";
}

export function getApiBaseUrl(): string {
	const url = process.env.NEXT_PUBLIC_API_URL;
	if (!url) {
		throw new Error("NEXT_PUBLIC_API_URL is not configured");
	}
	return url.replace(/\/$/, "");
}

export function mapAccountToUser(account: AccountPublicResponse): User {
	const full = account.full_name.trim();
	const parts = full.split(/\s+/).filter(Boolean);
	const firstName = parts[0] ?? "";
	const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";

	return {
		id: String(account.id),
		email: account.email,
		fullName: full || account.email,
		firstName,
		lastName,
		avatar: "",
		role: account.role as AccountRole,
	};
}

export type FetchAccountMeResult =
	| { ok: true; account: AccountPublicResponse }
	| { ok: false; status: number };

/**
 * GET /accounts/me — dùng chung middleware, BFF, profile.
 * 404: tài khoản không còn (hoặc route không khớp) → coi phiên hết hiệu lực.
 */
export async function fetchAccountMe(accessToken: string): Promise<FetchAccountMeResult> {
	const res = await fetch(`${getApiBaseUrl()}/api/v1/accounts/me`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
		},
		cache: "no-store",
	});

	if (!res.ok) {
		return { ok: false, status: res.status };
	}

	const account = (await res.json()) as AccountPublicResponse;
	return { ok: true, account };
}

export async function validateAccessToken(accessToken: string): Promise<boolean> {
	try {
		const me = await fetchAccountMe(accessToken);
		return me.ok;
	} catch {
		return false;
	}
}

export async function fetchAccountByAccessToken(accessToken: string): Promise<AccountPublicResponse | null> {
	try {
		const me = await fetchAccountMe(accessToken);
		return me.ok ? me.account : null;
	} catch {
		return null;
	}
}

export async function loginAccessToken(
	email: string,
	password: string
): Promise<{ access_token: string; user: AccountPublicResponse } | { detail: string }> {
	const body = new URLSearchParams();
	body.set("username", email);
	body.set("password", password);

	const res = await fetch(`${getApiBaseUrl()}/api/v1/login/access-token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body,
		cache: "no-store",
	});

	const data = (await res.json()) as {
		access_token?: string;
		user?: AccountPublicResponse;
		detail?: unknown;
	};

	if (!res.ok) {
		const detail = formatErrorDetail(data.detail);
		return { detail };
	}

	if (!data.access_token) {
		return { detail: "Invalid response from server" };
	}

	if (data.user) {
		return { access_token: data.access_token, user: data.user };
	}

	/* Backend cũ không trả user — fallback một lần GET /me */
	const account = await fetchAccountByAccessToken(data.access_token);
	if (!account) {
		return { detail: "Invalid response from server" };
	}
	return { access_token: data.access_token, user: account };
}

export async function requestPasswordRecoveryEmail(email: string): Promise<{ ok: true } | { error: string }> {
	const res = await fetch(`${getApiBaseUrl()}/api/v1/password-recovery/${encodeURIComponent(email)}`, {
		method: "POST",
		headers: { Accept: "application/json" },
		cache: "no-store",
	});

	const data = (await res.json().catch(() => ({}))) as { detail?: unknown };

	if (res.status === 429) {
		const detail =
			typeof data.detail === "string"
				? data.detail
				: "Quá nhiều yêu cầu. Vui lòng thử lại sau vài phút.";
		return { error: detail };
	}

	if (!res.ok) {
		const detail =
			typeof data.detail === "string"
				? data.detail
				: "Không thể gửi email khôi phục. Vui lòng thử lại sau.";
		return { error: detail };
	}

	return { ok: true };
}

export async function submitPasswordReset(
	token: string,
	newPassword: string
): Promise<{ ok: true } | { error: string }> {
	const res = await fetch(`${getApiBaseUrl()}/api/v1/reset-password/`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ token, new_password: newPassword }),
		cache: "no-store",
	});

	const data = (await res.json().catch(() => ({}))) as { detail?: unknown; message?: string };

	if (!res.ok) {
		const detail =
			typeof data.detail === "string"
				? data.detail
				: "Không thể đặt lại mật khẩu. Vui lòng thử lại.";
		return { error: detail };
	}

	return { ok: true };
}
