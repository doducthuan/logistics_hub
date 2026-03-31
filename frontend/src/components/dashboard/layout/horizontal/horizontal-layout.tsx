"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import GlobalStyles from "@mui/material/GlobalStyles";

import { useAuth } from "@/components/auth/custom/auth-context";
import { dashboardConfig } from "@/config/dashboard";
import { useSettings } from "@/components/core/settings/settings-context";
import { filterDashboardNavItemsForRole } from "@/lib/dashboard-nav";

import { MainNav } from "./main-nav";

export interface HorizontalLayoutProps {
	children?: React.ReactNode;
}

export function HorizontalLayout({ children }: HorizontalLayoutProps): React.JSX.Element {
	const { settings } = useSettings();
	const { user } = useAuth();

	const navColor = settings.dashboardNavColor ?? dashboardConfig.navColor;
	const navItems = React.useMemo(
		() => filterDashboardNavItemsForRole(dashboardConfig.navItems, user?.role),
		[user?.role],
	);

	return (
		<React.Fragment>
			<GlobalStyles
				styles={{ body: { "--MainNav-zIndex": 1000, "--MobileNav-width": "320px", "--MobileNav-zIndex": 1100 } }}
			/>
			<Box
				sx={{
					bgcolor: "var(--mui-palette-background-default)",
					display: "flex",
					flexDirection: "column",
					position: "relative",
					minHeight: "100%",
				}}
			>
				<MainNav color={navColor} items={navItems} />
				<Box
					component="main"
					sx={{
						"--Content-margin": "0 auto",
						"--Content-maxWidth": "var(--maxWidth-xl)",
						"--Content-paddingX": "24px",
						"--Content-paddingY": { xs: "24px", lg: "64px" },
						"--Content-padding": "var(--Content-paddingY) var(--Content-paddingX)",
						"--Content-width": "100%",
						display: "flex",
						flex: "1 1 auto",
						flexDirection: "column",
					}}
				>
					{children}
				</Box>
			</Box>
		</React.Fragment>
	);
}
