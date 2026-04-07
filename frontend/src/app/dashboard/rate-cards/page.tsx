import type * as React from "react";
import type { Metadata } from "next";

import { RateCardsView } from "@/components/dashboard/rate-card/rate-cards-view";
import { appConfig } from "@/config/app";

export const metadata = { title: `Bảng giá cước | Dashboard | ${appConfig.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
	return <RateCardsView />;
}
