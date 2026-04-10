import type * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountsView } from "@/components/dashboard/account/accounts-view";
import { appConfig } from "@/config/app";
import { getAccountsPageForSessionCached } from "@/lib/accounts/fetch-accounts-server";
import { paths } from "@/paths";

export const metadata = { title: `Accounts | Dashboard | ${appConfig.name}` } satisfies Metadata;

export default async function Page(): Promise<React.JSX.Element> {
	/* Một lần GET /me + list — không gọi thêm getUser() (trùng /me). */
	const initial = await getAccountsPageForSessionCached({ page: 0, pageSize: 10, keyword: "" });

	if (!initial.ok) {
		if (initial.status === 401 || initial.status === 404) {
			redirect(paths.auth.custom.signOut);
		}
		if (initial.status === 403) {
			redirect(paths.dashboard.overview);
		}
		return <AccountsView initialPayload={null} />;
	}

	return <AccountsView initialPayload={initial.data} />;
}
