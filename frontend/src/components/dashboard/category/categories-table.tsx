"use client";

import * as React from "react";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { EyeIcon } from "@phosphor-icons/react/dist/ssr/Eye";

import { dayjs } from "@/lib/dayjs";
import type { ColumnDef } from "@/components/core/data-table";
import { DataTable } from "@/components/core/data-table";

import type { CategoryItem } from "./types";

export interface CategoriesTableProps {
	rows: CategoryItem[];
	loading?: boolean;
	page: number;
	rowsPerPage: number;
	onView: (row: CategoryItem) => void;
}

export function CategoriesTable({
	rows,
	loading = false,
	page,
	rowsPerPage,
	onView,
}: CategoriesTableProps): React.JSX.Element {
	const columns = React.useMemo<ColumnDef<CategoryItem>[]>(
		() => [
			{
				name: "STT",
				align: "center",
				width: "72px",
				formatter: (_row, index) => page * rowsPerPage + index + 1,
			},
			{
				name: "Tên",
				width: "220px",
				formatter: (row) => (
					<Typography sx={{ whiteSpace: "nowrap" }} variant="subtitle2">
						{row.name}
					</Typography>
				),
			},
			{
				name: "Mô tả",
				width: "280px",
				formatter: (row) => row.description?.trim() || "—",
			},
			{
				name: "Trạng thái",
				align: "center",
				width: "140px",
				formatter: (row) =>
					row.is_active ? (
						<Chip color="success" label="Đang hoạt động" size="small" variant="outlined" />
					) : (
						<Chip color="error" label="Tạm khóa" size="small" variant="outlined" />
					),
			},
			{
				name: "Ngày tạo",
				align: "center",
				width: "170px",
				formatter: (row) =>
					row.created_at ? dayjs(row.created_at).format("DD/MM/YYYY") : "—",
			},
			{
				name: "Thao tác",
				hideName: true,
				align: "center",
				width: "90px",
				formatter: (row) => (
					<IconButton
						color="primary"
						onClick={() => {
							onView(row);
						}}
					>
						<EyeIcon />
					</IconButton>
				),
			},
		],
		[onView, page, rowsPerPage]
	);

	return (
		<React.Fragment>
			<DataTable<CategoryItem>
				columns={columns}
				headCellSx={(theme) => ({
					color:
						theme.palette.mode === "light" ? theme.palette.grey[900] : theme.palette.common.white,
					fontSize: "1rem",
					fontWeight: 700,
					letterSpacing: "0.02em",
				})}
				rows={rows}
			/>
			{rows.length === 0 ? (
				<Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }} variant="body2">
					{loading ? "Đang tải dữ liệu ..." : "Không có dữ liệu"}
				</Typography>
			) : null}
		</React.Fragment>
	);
}
