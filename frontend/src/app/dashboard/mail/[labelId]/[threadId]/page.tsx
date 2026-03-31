import type * as React from "react";
import type { Metadata } from "next";

import { appConfig } from "@/config/app";
import { ThreadView } from "@/components/dashboard/mail/thread-view";

export const metadata = { title: `Thread | Mail | Dashboard | ${appConfig.name}` } satisfies Metadata;

interface PageProps {
	params: Promise<{ threadId: string }>;
}

export default async function Page({ params }: PageProps): Promise<React.JSX.Element> {
	const { threadId } = await params;

	return <ThreadView threadId={threadId} />;
}
