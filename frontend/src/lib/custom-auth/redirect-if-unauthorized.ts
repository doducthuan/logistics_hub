import { paths } from "@/paths";

/** BFF đã xóa cookie khi /me 404/401 — đưa user về login thay vì để UI kẹt. */
export function redirectToLoginIfUnauthorized(res: Response): boolean {
	if (res.status === 401) {
		globalThis.location.assign(paths.login);
		return true;
	}
	return false;
}
