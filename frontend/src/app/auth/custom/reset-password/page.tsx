import type * as React from "react";
import type { Metadata } from "next";

import { appConfig } from "@/config/app";
import { ResetPasswordForm } from "@/components/auth/custom/reset-password-form";
import { SplitLayout } from "@/components/auth/split-layout";

export const metadata = { title: `Reset password | Custom | Auth | ${appConfig.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
	return (
		<SplitLayout>
			<ResetPasswordForm />
		</SplitLayout>
	);
}
