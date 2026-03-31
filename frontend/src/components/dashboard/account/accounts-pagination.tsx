"use client";

import type * as React from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;

export interface AccountsPaginationProps {
	/** Tổng số bản ghi (từ API). */
	count: number;
	/** Chỉ số trang 0-based (khớp TablePagination / API `page`). */
	page: number;
	rowsPerPage: number;
	onPageChange: (page: number) => void;
	onRowsPerPageChange: (rowsPerPage: number) => void;
	/** Bố cục gọn (modal, bảng phụ). */
	compact?: boolean;
}

/**
 * Phân trang danh sách tài khoản: nhãn trang, số trang dạng 1 … 5 6 7 … N, chọn page size.
 */
export function AccountsPagination({
	count,
	page,
	rowsPerPage,
	onPageChange,
	onRowsPerPageChange,
	compact = false,
}: AccountsPaginationProps): React.JSX.Element {
	const totalPages = count === 0 ? 0 : Math.max(1, Math.ceil(count / rowsPerPage));
	const pageOneBased = count === 0 ? 1 : Math.min(page + 1, totalPages);

	return (
		<Stack
			direction={{ xs: "column", lg: "row" }}
			spacing={compact ? 1.5 : 2}
			sx={{
				alignItems: { xs: "center", lg: "center" },
				flexWrap: { lg: "wrap" },
				justifyContent: { xs: "center", lg: "space-between" },
				px: compact ? 0 : 2,
				py: compact ? 1.5 : 2,
				width: "100%",
			}}
		>
			<Stack
				alignItems="center"
				direction="row"
				flexWrap="nowrap"
				justifyContent={{ xs: "center", lg: "flex-start" }}
				spacing={1.5}
				sx={{ flexShrink: 0, minWidth: 0, width: { xs: "100%", lg: "auto" } }}
			>
				<FormControl
					size="small"
					sx={{
						flexShrink: 0,
						minWidth: 0,
						width: compact ? 58 : 76,
					}}
					variant="outlined"
				>
					<Select
						aria-label="Số dòng mỗi trang"
						id="accounts-rows-per-page"
						onChange={(event) => {
							onRowsPerPageChange(Number(event.target.value));
						}}
						sx={{
							fontSize: compact ? "0.75rem" : undefined,
							"& .MuiSelect-select": {
								py: compact ? 0.35 : 0.65,
								px: compact ? 0.75 : undefined,
								minHeight: compact ? 0 : undefined,
								textAlign: "center",
							},
							"& .MuiSvgIcon-root": compact ? { fontSize: "1.125rem", right: 4 } : undefined,
						}}
						value={rowsPerPage}
					>
						{ROWS_PER_PAGE_OPTIONS.map((n) => (
							<MenuItem key={n} sx={compact ? { fontSize: "0.5rem", minHeight: 32, py: 0.25 } : undefined} value={n}>
								{n}
							</MenuItem>
						))}
					</Select>
				</FormControl>
				<Typography
					color="text.secondary"
					sx={{ minWidth: 0, textAlign: { xs: "center", lg: "left" } }}
					variant={compact ? "caption" : "body2"}
				>
					{count === 0 ? (
						<>Chưa có dữ liệu · Tổng 0 tài khoản</>
					) : (
						<>
							Trang <strong>{pageOneBased}</strong> / <strong>{totalPages}</strong>
							{" · "}
							Tổng <strong>{count}</strong> tài khoản
						</>
					)}
				</Typography>
			</Stack>

			<Box
				sx={{
					display: "flex",
					flex: { lg: 1 },
					justifyContent: { xs: "center", lg: "flex-end" },
					minWidth: 0,
					width: { xs: "100%", lg: "auto" },
				}}
			>
				<Pagination
					boundaryCount={1}
					color="primary"
					count={totalPages === 0 ? 1 : totalPages}
					disabled={count === 0}
					onChange={(_, value) => {
						onPageChange(value - 1);
					}}
					page={pageOneBased}
					showFirstButton
					showLastButton
					siblingCount={1}
					size={compact ? "small" : "medium"}
					sx={{
						"& .MuiPagination-ul": {
							flexWrap: "wrap",
							justifyContent: "center",
							rowGap: 0.5,
						},
					}}
				/>
			</Box>
		</Stack>
	);
}
