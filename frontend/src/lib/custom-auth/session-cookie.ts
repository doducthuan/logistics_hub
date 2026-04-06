import "server-only";

import { cookies } from "next/headers";

import { validateAccessToken } from "@/lib/custom-auth/api";
import { hasJwtSecretConfigured, isJwtAccessTokenValid } from "@/lib/custom-auth/jwt-verify";

/**
 * Kiểm tra cookie session hợp lệ mà không cần GET /accounts/me (khi đã cấu hình AUTH_JWT_SECRET).
 */
export async function hasValidSessionCookie(): Promise<boolean> {
	const token = (await cookies()).get("access_token")?.value;
	if (!token) {
		return false;
	}
	if (hasJwtSecretConfigured()) {
		return isJwtAccessTokenValid(token);
	}
	return validateAccessToken(token);
}
