import type * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appConfig } from "@/config/app";
import { paths } from "@/paths";
import { getUser } from "@/lib/custom-auth/server";
import { logger } from "@/lib/default-logger";
import { SignUpForm } from "@/components/auth/custom/sign-up-form";
import { SplitLayout } from "@/components/auth/split-layout";

export const metadata = { title: `Sign up | Custom | Auth | ${appConfig.name}` } satisfies Metadata;

export default async function Page(): Promise<React.JSX.Element> {
	const { data } = await getUser();

	if (data?.user) {
		logger.debug("[Sign up] User is authenticated, redirecting to dashboard");
		redirect(paths.dashboard.overview);
	}

	return (
		<SplitLayout>
			<SignUpForm />
		</SplitLayout>
	);
}
