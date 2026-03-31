import type * as React from "react";
import type { Metadata } from "next";

import { appConfig } from "@/config/app";
import { ThreadView } from "@/components/dashboard/chat/thread-view";
import type { ThreadType } from "@/components/dashboard/chat/types";

export const metadata = { title: `Thread | Chat | Dashboard | ${appConfig.name}` } satisfies Metadata;

interface PageProps {
	params: Promise<{ threadId: string; threadType: ThreadType }>;
}

export default async function Page({ params }: PageProps): Promise<React.JSX.Element> {
	const { threadId, threadType } = await params;

	return <ThreadView threadId={threadId} threadType={threadType} />;
}
