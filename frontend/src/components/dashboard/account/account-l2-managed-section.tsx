"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import LinearProgress from "@mui/material/LinearProgress";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { AccountL2ChildrenTable } from "./account-l2-children-table";
import { ListPagination } from "@/components/core/list-pagination";
import type { AccountItem } from "./types";

function extractErrorMessage(payload: unknown): string {
	if (payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string") {
		return payload.detail;
	}
	return "Không tải được danh sách";
}

export interface AccountL2ManagedSectionProps {
	/** Id User cấp 1 (parent của L2). */
	parentId: string;
	enabled: boolean;
}

/**
 * Danh sách User cấp 2 trong modal chi tiết L1: tìm kiếm + phân trang (server).
 * Chỉ render khi có ít nhất một User cấp 2 (probe không keyword).
 */
export function AccountL2ManagedSection({ parentId, enabled }: AccountL2ManagedSectionProps): React.JSX.Element | null {
	const [rows, setRows] = React.useState<AccountItem[]>([]);
	const [count, setCount] = React.useState(0);
	const [page, setPage] = React.useState(0);
	const [rowsPerPage, setRowsPerPage] = React.useState(10);
	const [searchText, setSearchText] = React.useState("");
	const [appliedKeyword, setAppliedKeyword] = React.useState("");
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	/** null = chưa probe; true/false = đã biết có hay không User cấp 2 (không keyword, trang 0). */
	const [hasAnyL2, setHasAnyL2] = React.useState<boolean | null>(null);

	const loadData = React.useCallback(
		async (signal?: AbortSignal): Promise<void> => {
			if (!enabled || !parentId) {
				return;
			}
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams({
					parentId,
					page: String(page),
					pageSize: String(rowsPerPage),
				});
				if (appliedKeyword) {
					params.set("keyword", appliedKeyword);
				}
				const res = await fetch(`/api/accounts/under?${params.toString()}`, {
					cache: "no-store",
					signal,
				});
				if (signal?.aborted) {
					return;
				}
				const payload = (await res.json().catch(() => ({}))) as unknown;
				if (signal?.aborted) {
					return;
				}

				if (!res.ok) {
					setError(extractErrorMessage(payload));
					setRows([]);
					setCount(0);
					if (appliedKeyword === "" && page === 0) {
						setHasAnyL2(false);
					}
					return;
				}

				const data = payload as { data?: AccountItem[]; count?: number };
				const list = data.data ?? [];
				const total = typeof data.count === "number" ? data.count : 0;

				setRows(list);
				setCount(total);

				if (appliedKeyword === "" && page === 0) {
					setHasAnyL2(total > 0);
				}
			} catch (e) {
				if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
					return;
				}
				setError("Không thể kết nối máy chủ");
				setRows([]);
				setCount(0);
				if (appliedKeyword === "" && page === 0) {
					setHasAnyL2(false);
				}
			} finally {
				setLoading(false);
			}
		},
		[appliedKeyword, enabled, page, parentId, rowsPerPage]
	);

	React.useEffect(() => {
		if (!enabled || !parentId) {
			setRows([]);
			setCount(0);
			setPage(0);
			setSearchText("");
			setAppliedKeyword("");
			setHasAnyL2(null);
			setError(null);
			return;
		}

		const ac = new AbortController();
		void loadData(ac.signal);

		return () => {
			ac.abort();
		};
	}, [enabled, loadData, parentId]);

	React.useEffect(() => {
		if (!enabled || count <= 0) {
			return;
		}
		const totalPages = Math.max(1, Math.ceil(count / rowsPerPage));
		if (page >= totalPages) {
			setPage(totalPages - 1);
		}
	}, [count, enabled, page, rowsPerPage]);

	if (!enabled || !parentId) {
		return null;
	}

	if (hasAnyL2 === false) {
		return null;
	}

	if (hasAnyL2 === null) {
		return (
			<Box sx={{ pt: 0.5 }}>
				<LinearProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ maxWidth: "100%", minWidth: 0, pt: 1, width: "100%" }}>
			<Typography sx={{ mb: 1, fontSize: "0.9rem", fontWeight: 600 }} variant="subtitle2">
				Danh sách tài khoản do tài khoản này quản lý
			</Typography>
			<Stack spacing={1.5} sx={{ maxWidth: "100%", minWidth: 0 }}>
				<FormControl fullWidth size="small">
					<OutlinedInput
						placeholder="Tìm kiếm"
						size="small"
						onChange={(event) => {
							setSearchText(event.target.value);
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								setPage(0);
								setAppliedKeyword(searchText.trim());
							}
						}}
						value={searchText}
					/>
				</FormControl>
				{error ? (
					<Alert
						action={
							<Typography
								component="button"
								onClick={() => {
									void loadData();
								}}
								sx={{ cursor: "pointer", border: 0, background: "none", textDecoration: "underline" }}
								variant="caption"
							>
								Thử lại
							</Typography>
						}
						severity="error"
					>
						{error}
					</Alert>
				) : null}
				<Box sx={{ position: "relative" }}>
					{loading ? (
						<LinearProgress sx={{ left: 0, position: "absolute", right: 0, top: 0, zIndex: 2 }} />
					) : null}
					<Box sx={{ opacity: loading ? 0.7 : 1, transition: "opacity 120ms ease" }}>
						<AccountL2ChildrenTable compact rows={rows} />
					</Box>
				</Box>
				{rows.length === 0 && !loading ? (
					<Typography color="text.secondary" sx={{ py: 1, textAlign: "center" }} variant="caption">
						Không có bản ghi phù hợp.
					</Typography>
				) : null}
				<Divider />
				<ListPagination
					compact
					count={count}
					onPageChange={(newPage) => {
						setPage(newPage);
					}}
					onRowsPerPageChange={(next) => {
						setRowsPerPage(next);
						setPage(0);
					}}
					page={page}
					recordLabelPlural="tài khoản"
					rowsPerPage={rowsPerPage}
				/>
			</Stack>
		</Box>
	);
}
