import type { Theme } from "@mui/material/styles";

/**
 * Tiêu đề bảng dashboard giống `DataTable` + `headCellSx` (vd. Account, Loại mặt hàng).
 * Dùng cho các bảng MUI thuần cần đồng bộ typographic / độ đậm với các màn đó.
 */
export function dashboardTableHeadCellSx(theme: Theme): {
	color: string;
	fontSize: string;
	fontWeight: number;
	letterSpacing: string;
} {
	return {
		color: theme.palette.mode === "light" ? theme.palette.grey[900] : theme.palette.common.white,
		fontSize: "1rem",
		fontWeight: 700,
		letterSpacing: "0.02em",
	};
}
