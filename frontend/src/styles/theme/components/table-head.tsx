import type { Components } from "@mui/material/styles";
import { tableCellClasses } from "@mui/material/TableCell";

import type { Theme } from "../types";

export const MuiTableHead = {
	styleOverrides: {
		root: {
			[`& .${tableCellClasses.root}`]: {
				backgroundColor: "var(--mui-palette-background-level1)",
				// Không set `color` ở đây: selector con có specificity cao hơn `sx` trên TableCell,
				// khiến style header (đậm, màu đậm) từ từng bảng không có hiệu lực.
			},
		},
	},
} satisfies Components<Theme>["MuiTableHead"];
