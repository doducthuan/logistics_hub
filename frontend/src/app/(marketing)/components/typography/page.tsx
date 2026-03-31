import type * as React from "react";
import type { Metadata } from "next";

import { appConfig } from "@/config/app";
import { Layout } from "@/components/widgets/layout";
import type { Component } from "@/components/widgets/layout";
import { Typography1 } from "@/components/widgets/typography/typography-1";

export const metadata = { title: `Typography | Components | ${appConfig.name}` } satisfies Metadata;

const components = [{ title: "Typography 1", element: <Typography1 /> }] satisfies Component[];

export default function Page(): React.JSX.Element {
	return <Layout components={components} title="Typography" />;
}
