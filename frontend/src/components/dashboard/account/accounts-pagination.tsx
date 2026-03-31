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
}: AccountsPaginationProps): React.JSX.Element {
	const totalPages = count === 0 ? 0 : Math.max(1, Math.ceil(count / rowsPerPage));
	const pageOneBased = count === 0 ? 1 : Math.min(page + 1, totalPages);

	return (
		<Stack
			direction={{ xs: "column", md: "row" }}
			spacing={2}
			sx={{
				alignItems: { xs: "stretch", md: "center" },
				flexWrap: "wrap",
				justifyContent: "space-between",
				px: 2,
				py: 2,
			}}
		>
			<Stack alignItems="center" direction="row" flexWrap="nowrap" spacing={1.5} sx={{ flexShrink: 0, minWidth: 0 }}>
				<FormControl
					size="small"
					sx={{
						flexShrink: 0,
						minWidth: 0,
						width: 76,
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
							"& .MuiSelect-select": { py: 0.65, textAlign: "center" },
						}}
						value={rowsPerPage}
					>
						{ROWS_PER_PAGE_OPTIONS.map((n) => (
							<MenuItem key={n} value={n}>
								{n}
							</MenuItem>
						))}
					</Select>
				</FormControl>
				<Typography color="text.secondary" sx={{ minWidth: 0 }} variant="body2">
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
					flex: { md: 1 },
					justifyContent: "flex-end",
					minWidth: 0,
					width: { xs: "100%", md: "auto" },
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
					size="medium"
				/>
			</Box>
		</Stack>
	);
}
