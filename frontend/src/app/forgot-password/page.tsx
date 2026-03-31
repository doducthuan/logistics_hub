import type * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appConfig } from "@/config/app";
import { paths } from "@/paths";
import { getUser } from "@/lib/custom-auth/server";
import { logger } from "@/lib/default-logger";
import { ResetPasswordForm } from "@/components/auth/custom/reset-password-form";
import { CenteredLayout } from "@/components/auth/centered-layout";

export const metadata = { title: `Forgot password | ${appConfig.name}` } satisfies Metadata;

export default async function Page(): Promise<React.JSX.Element> {
	const { data } = await getUser();

	if (data?.user) {
		logger.debug("[Forgot password] User is authenticated, redirecting to dashboard");
		redirect(paths.dashboard.overview);
	}

	return (
		<CenteredLayout>
			<ResetPasswordForm variant="card" />
		</CenteredLayout>
	);
}
