import type { NavItemConfig } from "@/types/nav";
import type { AccountRole } from "@/lib/custom-auth/types";

const NAV_KEYS_HIDDEN_FOR_LEVEL_2 = new Set(["accounts"]);

/**
 * User cấp 2 không quản lý danh sách tài khoản hệ thống — ẩn mục menu tương ứng.
 */
export function filterDashboardNavItemsForRole(
	items: NavItemConfig[],
	role: AccountRole | undefined,
): NavItemConfig[] {
	if (role !== "user_level_2") {
		return items;
	}

	return items.map((group) => {
		if (!group.items?.length) {
			return group;
		}
		const nextItems = group.items.filter((item) => !NAV_KEYS_HIDDEN_FOR_LEVEL_2.has(item.key));
		return { ...group, items: nextItems };
	});
}
