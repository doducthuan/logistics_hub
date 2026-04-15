import { jwtVerify } from "jose";

const HS256 = "HS256";

/** Trùng `PASSWORD_RESET_JWT_TYP` backend — token đặt lại mật khẩu không được dùng như access token. */
const PASSWORD_RESET_JWT_TYP = "pwd_reset";

function getJwtSecret(): Uint8Array | null {
	const raw = process.env.AUTH_JWT_SECRET ?? process.env.SECRET_KEY;
	if (!raw) {
		return null;
	}
	return new TextEncoder().encode(raw);
}

/**
 * Xác thực access token JWT (HS256) giống backend FastAPI, không gọi API.
 * Cần AUTH_JWT_SECRET hoặc SECRET_KEY trùng với SECRET_KEY của backend.
 */
export async function isJwtAccessTokenValid(token: string): Promise<boolean> {
	const secret = getJwtSecret();
	if (!secret) {
		return false;
	}
	try {
		const { payload } = await jwtVerify(token, secret, { algorithms: [HS256] });
		/* Access token chỉ có sub + exp; token reset có typ — không coi là phiên đăng nhập. */
		if (payload.typ === PASSWORD_RESET_JWT_TYP) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}

export function hasJwtSecretConfigured(): boolean {
	return getJwtSecret() !== null;
}
