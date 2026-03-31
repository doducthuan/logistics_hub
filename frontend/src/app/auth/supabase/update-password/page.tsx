import type * as React from "react";
import type { Metadata } from "next";

import { appConfig } from "@/config/app";
import { SplitLayout } from "@/components/auth/split-layout";
import { UpdatePasswordForm } from "@/components/auth/supabase/update-password-form";

export const metadata = { title: `Update password | Supabase | Auth | ${appConfig.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
	return (
		<SplitLayout>
			<UpdatePasswordForm />
		</SplitLayout>
	);
}
