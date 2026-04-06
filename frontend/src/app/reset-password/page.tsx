import type * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { appConfig } from "@/config/app";
import { paths } from "@/paths";
import { getUser } from "@/lib/custom-auth/server";
import { logger } from "@/lib/default-logger";
import { SetNewPasswordForm } from "@/components/auth/custom/set-new-password-form";
import { CenteredLayout } from "@/components/auth/centered-layout";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

export const metadata = { title: `Đặt lại mật khẩu | ${appConfig.name}` } satisfies Metadata;

function FormFallback(): React.JSX.Element {
	return (
		<Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
			<CircularProgress />
		</Box>
	);
}

export default async function Page(): Promise<React.JSX.Element> {
	const { data } = await getUser();

	if (data?.user) {
		logger.debug("[Reset password] User is authenticated, redirecting to dashboard");
		redirect(paths.dashboard.overview);
	}

	return (
		<CenteredLayout>
			<Suspense fallback={<FormFallback />}>
				<SetNewPasswordForm />
			</Suspense>
		</CenteredLayout>
	);
}
