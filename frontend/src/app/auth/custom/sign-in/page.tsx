import type * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appConfig } from "@/config/app";
import { paths } from "@/paths";

export const metadata = { title: `Sign in | Custom | Auth | ${appConfig.name}` } satisfies Metadata;

export default function Page() {
	redirect(paths.login);
}
