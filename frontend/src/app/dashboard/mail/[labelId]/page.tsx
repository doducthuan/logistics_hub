import type * as React from "react";
import type { Metadata } from "next";

import { appConfig } from "@/config/app";
import { ThreadsView } from "@/components/dashboard/mail/threads-view";

export const metadata = { title: `Mail | Dashboard | ${appConfig.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
	return <ThreadsView />;
}
