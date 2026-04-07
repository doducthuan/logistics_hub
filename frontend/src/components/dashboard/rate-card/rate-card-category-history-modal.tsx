"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

import { dashboardTableHeadCellSx } from "@/components/dashboard/dashboard-table-presets";
import { dayjs } from "@/lib/dayjs";

import type { RateCardCategoryHistoryResponse, RateCardHistoryEntry } from "./types";

/** Định dạng số tiền từ API (decimal string) giống lưới chỉnh sửa chính. */
function formatVndFromApi(raw: string): string {
	const numeric = Number.parseFloat(raw || "0");
	if (Number.isNaN(numeric)) {
		return "—";
	}
	const fixed = numeric.toFixed(2);
	const dot = fixed.indexOf(".");
	const intRaw = dot < 0 ? fixed : fixed.slice(0, dot);
	const decRaw = dot < 0 ? "" : fixed.slice(dot + 1).replace(/0+$/, "");
	const intDigits = intRaw.replaceAll(/[^0-9]/g, "");
	const intNum = intDigits === "" ? "0" : intDigits.replace(/^0+(?=\d)/, "") || "0";
	const intWithSep = intNum.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ",");
	if (!decRaw) {
		return intWithSep;
	}
	return `${intWithSep}.${decRaw}`;
}

export interface RateCardCategoryHistoryModalProps {
	open: boolean;
	onClose: () => void;
	accountId: string;
	categoryId: string;
	categoryTitle: string;
}

export function RateCardCategoryHistoryModal({
	open,
	onClose,
	accountId,
	categoryId,
	categoryTitle,
}: RateCardCategoryHistoryModalProps): React.JSX.Element {
	const theme = useTheme();
	// `palette.text.primary` có thể là CSS var — `alpha()` chỉ chấp nhận màu dạng #/rgb.
	const emptyHistoryBg =
		theme.palette.mode === "light"
			? alpha(theme.palette.common.black, 0.04)
			: alpha(theme.palette.common.white, 0.07);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [rows, setRows] = React.useState<RateCardHistoryEntry[]>([]);
	const [resolvedTitle, setResolvedTitle] = React.useState<string>(categoryTitle);

	React.useEffect(() => {
		if (!open || !accountId || !categoryId) {
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		setRows([]);
		setResolvedTitle(categoryTitle);

		void (async () => {
			try {
				const res = await fetch(
					`/api/account-rate-cards/by-account/${encodeURIComponent(accountId)}/category/${encodeURIComponent(categoryId)}/history`,
					{ cache: "no-store" }
				);
				const payload = (await res.json().catch(() => ({}))) as Partial<RateCardCategoryHistoryResponse> & {
					detail?: string;
				};
				if (cancelled) {
					return;
				}
				if (!res.ok) {
					setError(payload.detail ?? "Không tải được lịch sử giá");
					return;
				}
				const data = Array.isArray(payload.data) ? payload.data : [];
				setRows(data);
				if (payload.category_name) {
					setResolvedTitle(payload.category_name);
				}
			} catch {
				if (!cancelled) {
					setError("Không thể kết nối máy chủ");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [open, accountId, categoryId, categoryTitle]);

	return (
		<Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
			<DialogTitle sx={{ pr: 6 }}>
				<Stack alignItems="flex-start" spacing={0.5}>
					<Typography component="span" sx={{ fontWeight: 700 }} variant="h6">
						{resolvedTitle}
					</Typography>
				</Stack>
				<IconButton
					aria-label="Đóng"
					onClick={onClose}
					sx={{ position: "absolute", right: 8, top: 8 }}
				>
					<XIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent>
				{loading ? (
					<Stack alignItems="center" py={4}>
						<CircularProgress size={32} />
					</Stack>
				) : null}
				{error ? (
					<Alert severity="error" sx={{ mb: 2 }}>
						{error}
					</Alert>
				) : null}
				{!loading && !error ? (
					<TableContainer sx={{ maxHeight: 420, width: "100%" }}>
						<Table stickyHeader sx={{ width: "100%" }}>
							<TableHead>
								<TableRow>
									<TableCell
										align="center"
										sx={{
											...dashboardTableHeadCellSx(theme),
											maxWidth: 72,
											minWidth: 72,
											width: 72,
										}}
									>
										STT
									</TableCell>
									<TableCell
										align="center"
										sx={{
											...dashboardTableHeadCellSx(theme),
											minWidth: 160,
										}}
									>
										Ngày áp dụng
									</TableCell>
									<TableCell
										align="right"
										sx={{
											...dashboardTableHeadCellSx(theme),
											minWidth: 180,
										}}
									>
										Giá cước (VNĐ/Kg)
									</TableCell>
									<TableCell
										align="right"
										sx={{
											...dashboardTableHeadCellSx(theme),
											minWidth: 160,
										}}
									>
										Phụ thu (VNĐ)
									</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={4}
											sx={{
												bgcolor: emptyHistoryBg,
												border: 0,
												color: "text.secondary",
												py: 6,
												textAlign: "center",
												typography: "body2",
											}}
										>
											Chưa có dữ liệu lịch sử.
										</TableCell>
									</TableRow>
								) : (
									rows.map((row, index) => (
										<TableRow
											key={`${row.effective_date}-${index}`}
											sx={{
												bgcolor: row.is_currently_effective
													? theme.palette.mode === "light"
														? "rgba(46, 125, 50, 0.1)"
														: "rgba(129, 199, 132, 0.16)"
													: undefined,
											}}
										>
											<TableCell align="center">
												<Typography variant="body2">{index + 1}</Typography>
											</TableCell>
											<TableCell align="center">
												<Typography variant="body2">
													{dayjs(row.effective_date).format("DD/MM/YYYY")}
												</Typography>
											</TableCell>
											<TableCell align="right">
												<Typography variant="body2">{formatVndFromApi(row.unit_rate)}</Typography>
											</TableCell>
											<TableCell align="right">
												<Typography variant="body2">{formatVndFromApi(row.surcharge)}</Typography>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</TableContainer>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
