import { paths } from "@/paths";

/**
 * Prevent open redirects: only same-origin relative paths are allowed.
 */
export function getSafeCallbackPath(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
		return paths.dashboard.overview;
	}
	return raw;
}
