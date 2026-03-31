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

import { AccountCreateModal } from "./account-create-modal";
import { AccountDetailsModal } from "./account-details-modal";
import { AccountsPagination } from "./accounts-pagination";
import { AccountsTable } from "./accounts-table";
import type { AccountItem, AccountsApiResponse } from "./types";

function extractErrorMessage(payload: unknown): string {
	if (payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string") {
		return payload.detail;
	}
	return "Failed to load accounts";
}

export function AccountsView(): React.JSX.Element {
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [currentAccount, setCurrentAccount] = React.useState<AccountItem | null>(null);
	const [managedAccounts, setManagedAccounts] = React.useState<AccountItem[]>([]);
	const [allScopeAccounts, setAllScopeAccounts] = React.useState<AccountItem[]>([]);
	const [count, setCount] = React.useState(0);
	const [page, setPage] = React.useState(0);
	const [rowsPerPage, setRowsPerPage] = React.useState(10);
	const [searchText, setSearchText] = React.useState("");
	/** Từ khóa đã gửi lên API — chỉ cập nhật khi nhấn Enter trong ô tìm kiếm */
	const [appliedKeyword, setAppliedKeyword] = React.useState("");

	const [createOpen, setCreateOpen] = React.useState(false);
	const [detailsOpen, setDetailsOpen] = React.useState(false);
	const [selectedAccount, setSelectedAccount] = React.useState<AccountItem | null>(null);

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
			const res = await fetch(`/api/accounts?${params.toString()}`, { method: "GET", cache: "no-store" });
			const payload = (await res.json().catch(() => ({}))) as unknown;

			if (!res.ok) {
				setError(extractErrorMessage(payload));
				return;
			}

			const data = payload as AccountsApiResponse;

			setCurrentAccount(data.current);
			setManagedAccounts(data.data);
			setAllScopeAccounts(data.data);
			setCount(data.count);
		} catch {
			setError("Cannot reach server");
		} finally {
			setLoading(false);
		}
	}, [appliedKeyword, page, rowsPerPage]);

	React.useEffect(() => {
		void loadData();
	}, [loadData]);

	/** Khi tổng số trang giảm (đổi page size / filter) hoặc hết dữ liệu, giữ page hợp lệ. */
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
							<Typography variant="h4">Tài khoản</Typography>
						</Box>
						<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
							<Button
								disabled={!currentAccount}
								onClick={() => {
									setCreateOpen(true);
								}}
								startIcon={<PlusIcon />}
								variant="contained"
							>
								Thêm mới
							</Button>
						</Box>
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
									label="Tìm kiếm theo tên, email, số điện thoại, mô tả"
									onChange={(event) => {
										setSearchText(event.target.value);
									}}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											const value = event.currentTarget.value.trim();
											setPage(0);
											setAppliedKeyword(value);
										}
									}}
									placeholder="Tìm kiếm"
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
								<AccountsTable
									loading={loading}
									onView={(account) => {
										setSelectedAccount(account);
										setDetailsOpen(true);
									}}
									rows={managedAccounts}
								/>
							</Box>
						</Box>
						<Divider />
						<AccountsPagination
							count={count}
							onPageChange={(newPage) => {
								setPage(newPage);
							}}
							onRowsPerPageChange={(next) => {
								setRowsPerPage(next);
								setPage(0);
							}}
							page={page}
							rowsPerPage={rowsPerPage}
						/>
					</Card>
				</Stack>
			</Box>

			{currentAccount ? (
				<AccountCreateModal
					currentAccount={currentAccount}
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
			<AccountDetailsModal
				allScopeAccounts={allScopeAccounts}
				account={selectedAccount}
				onClose={() => {
					setDetailsOpen(false);
					setSelectedAccount(null);
				}}
				onUpdated={loadData}
				open={detailsOpen}
				viewerAccount={currentAccount}
			/>
		</React.Fragment>
	);
}
