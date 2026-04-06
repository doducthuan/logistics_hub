import type * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appConfig } from "@/config/app";
import { paths } from "@/paths";
import { hasValidSessionCookie } from "@/lib/custom-auth/session-cookie";
import { getSafeCallbackPath } from "@/lib/safe-callback-url";
import { logger } from "@/lib/default-logger";
import { SignInForm } from "@/components/auth/custom/sign-in-form";
import { CenteredLayout } from "@/components/auth/centered-layout";

export const metadata = { title: `Sign in | ${appConfig.name}` } satisfies Metadata;

interface PageProps {
	searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function Page({ searchParams }: PageProps): Promise<React.JSX.Element> {
	const sp = await searchParams;

	if (await hasValidSessionCookie()) {
		logger.debug("[Login] User is authenticated, redirecting");
		redirect(getSafeCallbackPath(sp.callbackUrl));
	}

	return (
		<CenteredLayout>
			<SignInForm callbackUrl={sp.callbackUrl} variant="app" />
		</CenteredLayout>
	);
}
