import type * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CategoriesView } from "@/components/dashboard/category/categories-view";
import { appConfig } from "@/config/app";
import { getCategoriesPageForSessionCached } from "@/lib/categories/fetch-categories-server";
import { paths } from "@/paths";

export const metadata = { title: `Loại mặt hàng | Dashboard | ${appConfig.name}` } satisfies Metadata;

export default async function Page(): Promise<React.JSX.Element> {
	const initial = await getCategoriesPageForSessionCached({
		parentId: null,
		page: 0,
		pageSize: 10,
		keyword: "",
	});

	if (!initial.ok) {
		if (initial.status === 401) {
			redirect(paths.login);
		}
		return <CategoriesView initialPayload={null} />;
	}

	return <CategoriesView initialPayload={initial.data} />;
}
