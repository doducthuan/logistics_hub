import type * as React from "react";
import type { Metadata } from "next";

import { appConfig } from "@/config/app";
import { SplitLayout } from "@/components/auth/split-layout";
import { ResetPasswordForm } from "@/components/auth/supabase/reset-password-form";

export const metadata = { title: `Reset password | Supabase | Auth | ${appConfig.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
	return (
		<SplitLayout>
			<ResetPasswordForm />
		</SplitLayout>
	);
}
