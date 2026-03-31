import type * as React from "react";
import type { Metadata } from "next";

import { appConfig } from "@/config/app";
import { ComposeView } from "@/components/dashboard/chat/compose-view";

export const metadata = { title: `Compose | Chat | Dashboard | ${appConfig.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
	return <ComposeView />;
}
