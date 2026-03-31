import type * as React from "react";
import type { Metadata } from "next";
import Divider from "@mui/material/Divider";

import { appConfig } from "@/config/app";
import { Faqs } from "@/components/marketing/pricing/faqs";
import { PlansTable } from "@/components/marketing/pricing/plans-table";

export const metadata = { title: `Pricing | ${appConfig.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
	return (
		<div>
			<PlansTable />
			<Divider />
			<Faqs />
		</div>
	);
}
