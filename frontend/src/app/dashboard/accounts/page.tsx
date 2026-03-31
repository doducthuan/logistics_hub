import type * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountsView } from "@/components/dashboard/account/accounts-view";
import { appConfig } from "@/config/app";
import { getUser } from "@/lib/custom-auth/server";
import { paths } from "@/paths";

export const metadata = { title: `Accounts | Dashboard | ${appConfig.name}` } satisfies Metadata;

export default async function Page(): Promise<React.JSX.Element> {
	const { data } = await getUser();

	if (!data?.user) {
		redirect(paths.login);
	}

	if (data.user.role === "user_level_2") {
		redirect(paths.dashboard.overview);
	}

	return <AccountsView />;
}
