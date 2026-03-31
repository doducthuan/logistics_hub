import type * as React from "react";
import Box from "@mui/material/Box";

interface LayoutProps {
	children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps): React.JSX.Element {
	return (
		<Box sx={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: "100vh" }}>{children}</Box>
	);
}
