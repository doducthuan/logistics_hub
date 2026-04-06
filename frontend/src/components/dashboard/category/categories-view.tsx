"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import LinearProgress from "@mui/material/LinearProgress";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";

import { useAuth } from "@/components/auth/custom/auth-context";

import { CategoriesTable } from "./categories-table";
import { CategoryCreateModal } from "./category-create-modal";
import { CategoryDetailsModal } from "./category-details-modal";
import { ListPagination } from "@/components/core/list-pagination";
import type { CategoriesApiResponse, CategoryItem } from "./types";

const DEFAULT_SERVER_PAGE_SIZE = 10;

export interface CategoriesViewProps {
	initialPayload?: CategoriesApiResponse | null;
}

function extractErrorMessage(payload: unknown): string {
	if (payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string") {
		return payload.detail;
	}
	return "Không tải được danh sách";
}

export function CategoriesView({ initialPayload = null }: CategoriesViewProps): React.JSX.Element {
	const { user } = useAuth();
	const isAdmin = user?.role === "admin";

	const hasInitial = initialPayload != null;
	const [loading, setLoading] = React.useState(!hasInitial);
	const [error, setError] = React.useState<string | null>(null);
	const [rows, setRows] = React.useState<CategoryItem[]>(initialPayload?.data ?? []);
	const [count, setCount] = React.useState(initialPayload?.count ?? 0);
	const [page, setPage] = React.useState(0);
	const [rowsPerPage, setRowsPerPage] = React.useState(10);
	const [searchText, setSearchText] = React.useState("");
	const [appliedKeyword, setAppliedKeyword] = React.useState("");

	const [createOpen, setCreateOpen] = React.useState(false);
	const [detailsOpen, setDetailsOpen] = React.useState(false);
	const [selected, setSelected] = React.useState<CategoryItem | null>(null);

	/** Chỉ bỏ qua fetch client một lần khi RSC đã trả đúng trang gốc. */
	const consumedServerInitialRef = React.useRef(false);

	const loadData = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({
				page: String(page),
				pageSize: String(rowsPerPage),
			});
			if (appliedKeyword) {
				params.set("keyword", appliedKeyword);
			}
			const res = await fetch(`/api/categories?${params.toString()}`, { cache: "no-store" });
			const payload = (await res.json().catch(() => ({}))) as unknown;
			if (!res.ok) {
				setError(extractErrorMessage(payload));
				return;
			}
			const data = payload as CategoriesApiResponse;
			setRows(data.data);
			setCount(data.count);
		} catch {
			setError("Không thể kết nối máy chủ");
		} finally {
			setLoading(false);
		}
	}, [appliedKeyword, page, rowsPerPage]);

	React.useEffect(() => {
		const alignedRoot = page === 0 && rowsPerPage === DEFAULT_SERVER_PAGE_SIZE && appliedKeyword === "";
		if (initialPayload && alignedRoot && !consumedServerInitialRef.current) {
			consumedServerInitialRef.current = true;
			return;
		}
		void loadData();
	}, [appliedKeyword, initialPayload, loadData, page, rowsPerPage]);

	React.useEffect(() => {
		if (count === 0) {
			if (page !== 0) {
				setPage(0);
			}
			return;
		}
		const totalPages = Math.max(1, Math.ceil(count / rowsPerPage));
		if (page >= totalPages) {
			setPage(totalPages - 1);
		}
	}, [count, page, rowsPerPage]);

	return (
		<React.Fragment>
			<Box
				sx={{
					maxWidth: "var(--Content-maxWidth)",
					m: "var(--Content-margin)",
					p: "var(--Content-padding)",
					width: "var(--Content-width)",
				}}
			>
				<Stack spacing={4}>
					<Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
						<Box sx={{ flex: "1 1 auto" }}>
							<Typography variant="h4">Loại mặt hàng</Typography>
							{/* <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
								Danh sách loại gốc; loại con quản lý trong chi tiết hoặc khi tạo mới.
							</Typography> */}
						</Box>
						{isAdmin ? (
							<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
								<Button
									onClick={() => {
										setCreateOpen(true);
									}}
									startIcon={<PlusIcon />}
									variant="contained"
								>
									Thêm mới
								</Button>
							</Box>
						) : null}
					</Stack>

					<Card>
						{error ? (
							<Alert
								action={
									<Button color="inherit" size="small" onClick={() => void loadData()}>
										Thử lại
									</Button>
								}
								severity="error"
								sx={{ m: 2 }}
							>
								{error}
							</Alert>
						) : null}
						<Box sx={{ p: 2, pb: 1 }}>
							<FormControl fullWidth>
								<OutlinedInput
									onChange={(event) => {
										setSearchText(event.target.value);
									}}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											setPage(0);
											setAppliedKeyword(event.currentTarget.value.trim());
										}
									}}
									placeholder="Tìm kiếm theo tên, mô tả"
									value={searchText}
								/>
							</FormControl>
						</Box>
						<Box sx={{ position: "relative" }}>
							{loading ? (
								<LinearProgress sx={{ left: 0, position: "absolute", right: 0, top: 0, zIndex: 2 }} />
							) : null}
							<Box
								sx={{
									opacity: loading ? 0.7 : 1,
									overflowX: "auto",
									transition: "opacity 120ms ease",
								}}
							>
								<CategoriesTable
									loading={loading}
									onView={(row) => {
										setSelected(row);
										setDetailsOpen(true);
									}}
									page={page}
									rows={rows}
									rowsPerPage={rowsPerPage}
								/>
							</Box>
						</Box>
						<Divider />
						<ListPagination
							count={count}
							onPageChange={(newPage) => {
								setPage(newPage);
							}}
							onRowsPerPageChange={(next) => {
								setRowsPerPage(next);
								setPage(0);
							}}
							page={page}
							recordLabelPlural="loại mặt hàng"
							rowsPerPage={rowsPerPage}
						/>
					</Card>
				</Stack>
			</Box>

			{isAdmin ? (
				<CategoryCreateModal
					onClose={() => {
						setCreateOpen(false);
					}}
					onCreated={async () => {
						setPage(0);
						await loadData();
					}}
					open={createOpen}
				/>
			) : null}
			<CategoryDetailsModal
				category={selected}
				isAdmin={isAdmin}
				onClose={() => {
					setDetailsOpen(false);
					setSelected(null);
				}}
				onUpdated={loadData}
				open={detailsOpen}
			/>
		</React.Fragment>
	);
}
