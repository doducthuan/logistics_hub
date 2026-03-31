export const AuthStrategy = {
	NONE: "NONE",
	AUTH0: "AUTH0",
	CLERK: "CLERK",
	COGNITO: "COGNITO",
	CUSTOM: "CUSTOM",
	SUPABASE: "SUPABASE",
} as const;

const AUTH_STRATEGY_KEYS = new Set<string>(Object.keys(AuthStrategy));

/**
 * Resolves env like `custom` / `CUSTOM` / ` Custom ` to a valid strategy key.
 * If unset and `NEXT_PUBLIC_API_URL` is set, defaults to CUSTOM (FastAPI JWT stack).
 */
export function resolveAuthStrategyFromEnv(): keyof typeof AuthStrategy {
	const raw = process.env.NEXT_PUBLIC_AUTH_STRATEGY?.trim();
	if (raw) {
		const upper = raw.toUpperCase();
		if (AUTH_STRATEGY_KEYS.has(upper)) {
			return upper as keyof typeof AuthStrategy;
		}
	}
	if (process.env.NEXT_PUBLIC_API_URL?.trim()) {
		return AuthStrategy.CUSTOM;
	}
	return AuthStrategy.NONE;
}
