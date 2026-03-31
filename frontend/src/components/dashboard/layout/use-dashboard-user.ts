"use client";

import { appConfig } from "@/config/app";
import { AuthStrategy } from "@/lib/auth-strategy";
import { useAuth } from "@/components/auth/custom/auth-context";

export interface DashboardUserDisplay {
	name: string;
	email: string;
	avatar: string | undefined;
	initials: string;
	isLoading: boolean;
}

const demoUser: DashboardUserDisplay = {
	name: "Sofia Rivers",
	email: "sofia@devias.io",
	avatar: "/assets/avatar.png",
	initials: "SR",
	isLoading: false,
};

function getInitials(fullName: string, email: string): string {
	const t = fullName.trim();
	if (t) {
		const parts = t.split(/\s+/);
		if (parts.length >= 2) {
			const a = parts[0]?.[0];
			const b = parts[parts.length - 1]?.[0];
			if (a && b) return `${a}${b}`.toUpperCase();
		}
		return t.slice(0, 2).toUpperCase();
	}
	return email.slice(0, 2).toUpperCase();
}

export function useDashboardUser(): DashboardUserDisplay {
	const auth = useAuth();

	// Luôn ưu tiên user từ session (sau login /profile) — không phụ thuộc nhánh demo template
	if (auth.user) {
		const { user } = auth;
		const name =
			user.fullName.trim() ||
			[user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
			user.email;

		return {
			name,
			email: user.email,
			avatar: user.avatar || undefined,
			initials: getInitials(user.fullName || name, user.email),
			isLoading: false,
		};
	}

	if (auth.isLoading) {
		return {
			name: "",
			email: "",
			avatar: undefined,
			initials: "",
			isLoading: true,
		};
	}

	if (appConfig.authStrategy !== AuthStrategy.CUSTOM) {
		return demoUser;
	}

	return {
		name: "Account",
		email: "",
		avatar: undefined,
		initials: "?",
		isLoading: false,
	};
}
