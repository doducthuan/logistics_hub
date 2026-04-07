"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowCounterClockwise";
import { EyeIcon } from "@phosphor-icons/react/dist/ssr/Eye";

import { Option } from "@/components/core/option";
import { toast } from "@/components/core/toaster";
import { dayjs } from "@/lib/dayjs";
import type { AccountItem, AccountsApiResponse } from "@/components/dashboard/account/types";
import { dashboardTableHeadCellSx } from "@/components/dashboard/dashboard-table-presets";

import { RateCardCategoryHistoryModal } from "./rate-card-category-history-modal";
import type { RateCardRow, RateCardsByAccountResponse } from "./types";

type EditableRateCardRow = RateCardRow & {
	_unitRateInput: string;
	_surchargeInput: string;
	_selectedEffectiveDate: string | null;
};

/** Chuỗi lưu trong state: không ép .00 với số nguyên (50000 không thành 50000.00). */
function toMoneyInput(value: string): string {
	const safe = Number.parseFloat(value);
	if (Number.isNaN(safe) || safe === 0) {
		return "";
	}
	return String(parseFloat(safe.toFixed(2)));
}

function normalizeMoneyInput(raw: string): string {
	// Bỏ dấu phẩy ngăn cách phần nguyên; chỉ giữ số và tối đa một dấu chấm cho phần thập phân
	const cleaned = raw.replaceAll(",", "").replaceAll(/[^0-9.]/g, "");
	const firstDot = cleaned.indexOf(".");
	if (firstDot < 0) {
		return cleaned;
	}
	const intPart = cleaned.slice(0, firstDot + 1);
	const decimalPart = cleaned
		.slice(firstDot + 1)
		.replaceAll(".", "")
		.slice(0, 2);
	return `${intPart}${decimalPart}`;
}

/** Hiển thị tiền: phần nguyên có dấu phẩy; phần thập phân sau dấu chấm (tối đa 2 số). */
function formatMoneyDisplay(internal: string): string {
	if (internal === "") {
		return "";
	}
	const firstDot = internal.indexOf(".");
	const intRaw = firstDot < 0 ? internal : internal.slice(0, firstDot);
	const decRaw = firstDot < 0 ? "" : internal.slice(firstDot + 1).replaceAll(/[^0-9]/g, "").slice(0, 2);

	const intDigits = intRaw.replaceAll(/[^0-9]/g, "");
	if (intDigits === "" && decRaw === "") {
		return "";
	}
	const intNum = intDigits === "" ? "0" : intDigits.replace(/^0+(?=\d)/, "") || "0";
	const intWithSep = intNum.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ",");

	if (firstDot < 0) {
		return intWithSep;
	}
	if (decRaw.length === 0) {
		return `${intWithSep}.`;
	}
	// Không hiển thị .00 / .0 thừa — chỉ phần thập phân có nghĩa
	const decTrimmed = decRaw.replace(/0+$/, "");
	if (decTrimmed === "") {
		return intWithSep;
	}
	return `${intWithSep}.${decTrimmed}`;
}

function toCreateMoneyValue(raw: string): string {
	const numeric = Number.parseFloat(raw.replaceAll(",", "").replaceAll(/\s/g, "") || "0");
	if (Number.isNaN(numeric)) {
		return "0.00";
	}
	return numeric.toFixed(2);
}

function mapEditableRows(rows: RateCardRow[]): EditableRateCardRow[] {
	return rows.map((row) => ({
		...row,
		_unitRateInput: toMoneyInput(row.unit_rate),
		_surchargeInput: toMoneyInput(row.surcharge),
		_selectedEffectiveDate: null,
	}));
}

function toUtcStartOfDayIso(value: ReturnType<typeof dayjs> | null): string | null {
	if (!value) {
		return null;
	}
	return `${value.format("YYYY-MM-DD")}T00:00:00.000Z`;
}

export function RateCardsView(): React.JSX.Element {
	const theme = useTheme();
	const [accountsLoading, setAccountsLoading] = React.useState(true);
	const [rateCardsLoading, setRateCardsLoading] = React.useState(false);
	const [saving, setSaving] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const [viewerAccount, setViewerAccount] = React.useState<AccountItem | null>(null);
	const [accounts, setAccounts] = React.useState<AccountItem[]>([]);
	const [selectedAccountId, setSelectedAccountId] = React.useState<string>("");

	const [rows, setRows] = React.useState<EditableRateCardRow[]>([]);
	const [originalRows, setOriginalRows] = React.useState<Map<string, { unit: string; surcharge: string }>>(new Map());
	const [openDatePickerCategoryId, setOpenDatePickerCategoryId] = React.useState<string | null>(null);
	const [historyModal, setHistoryModal] = React.useState<{ categoryId: string; categoryName: string } | null>(null);

	const accountOptions = React.useMemo(() => {
		if (!viewerAccount) {
			return accounts;
		}
		const rest = accounts.filter((a) => a.id !== viewerAccount.id);
		return [viewerAccount, ...rest];
	}, [viewerAccount, accounts]);

	const isViewingSelf = Boolean(viewerAccount && selectedAccountId === viewerAccount.id);

	const loadAccounts = React.useCallback(async () => {
		setAccountsLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/accounts?page=0&pageSize=500", { cache: "no-store" });
			const payload = (await res.json().catch(() => ({}))) as Partial<AccountsApiResponse> & { detail?: string };
			if (!res.ok) {
				setError(payload.detail ?? "Không tải được danh sách tài khoản");
				return;
			}
			const current = payload.current ?? null;
			const accountData = Array.isArray(payload.data) ? payload.data : [];
			setViewerAccount(current);
			setAccounts(accountData);
		} catch {
			setError("Không thể kết nối máy chủ");
		} finally {
			setAccountsLoading(false);
		}
	}, []);

	const loadRateCards = React.useCallback(async (accountId: string) => {
		if (!accountId) {
			setRows([]);
			return;
		}
		setRateCardsLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/account-rate-cards/by-account/${encodeURIComponent(accountId)}`, {
				cache: "no-store",
			});
			const payload = (await res.json().catch(() => ({}))) as Partial<RateCardsByAccountResponse> & { detail?: string };
			if (!res.ok) {
				setError(payload.detail ?? "Không tải được bảng giá cước");
				return;
			}
			const data = Array.isArray(payload.data) ? payload.data : [];
			const nextRows = mapEditableRows(data);
			setRows(nextRows);
			setOriginalRows(
				new Map(
					nextRows.map((row) => [
						row.category_id,
						{
							unit: toCreateMoneyValue(row._unitRateInput),
							surcharge: toCreateMoneyValue(row._surchargeInput),
						},
					])
				)
			);
		} catch {
			setError("Không thể kết nối máy chủ");
		} finally {
			setRateCardsLoading(false);
		}
	}, []);

	React.useEffect(() => {
		void loadAccounts();
	}, [loadAccounts]);

	React.useEffect(() => {
		if (accountsLoading || accountOptions.length === 0) {
			return;
		}
		setSelectedAccountId((prev) => {
			if (prev && accountOptions.some((a) => a.id === prev)) {
				return prev;
			}
			return accountOptions[0]!.id;
		});
	}, [accountsLoading, accountOptions]);

	React.useEffect(() => {
		if (!selectedAccountId) {
			return;
		}
		void loadRateCards(selectedAccountId);
	}, [loadRateCards, selectedAccountId]);

	React.useEffect(() => {
		setOpenDatePickerCategoryId(null);
	}, [selectedAccountId]);

	const onCellChange = React.useCallback((categoryId: string, key: "_unitRateInput" | "_surchargeInput", value: string) => {
		const normalized = normalizeMoneyInput(value);
		setRows((prev) => prev.map((row) => (row.category_id === categoryId ? { ...row, [key]: normalized } : row)));
	}, []);

	const onEffectiveDateChange = React.useCallback((categoryId: string, dateIso: string | null) => {
		setRows((prev) =>
			prev.map((row) => (row.category_id === categoryId ? { ...row, _selectedEffectiveDate: dateIso } : row))
		);
	}, []);

	const handleUndoRow = React.useCallback((categoryId: string) => {
		const base = originalRows.get(categoryId);
		if (!base) {
			return;
		}
		setRows((prev) =>
			prev.map((row) =>
				row.category_id === categoryId
					? {
							...row,
							_unitRateInput: toMoneyInput(base.unit),
							_surchargeInput: toMoneyInput(base.surcharge),
							_selectedEffectiveDate: null,
						}
					: row
			)
		);
	}, [originalRows]);

	const changedRows = React.useMemo(() => {
		return rows.filter((row) => {
			const base = originalRows.get(row.category_id);
			if (!base) {
				return true;
			}
			return (
				toCreateMoneyValue(row._unitRateInput) !== base.unit ||
				toCreateMoneyValue(row._surchargeInput) !== base.surcharge
			);
		});
	}, [originalRows, rows]);

	const changedRowIds = React.useMemo(() => new Set(changedRows.map((row) => row.category_id)), [changedRows]);
	const hasMissingEffectiveDate = changedRows.some((row) => !row._selectedEffectiveDate);

	const handleSave = React.useCallback(async () => {
		if (isViewingSelf || !selectedAccountId || changedRows.length === 0 || hasMissingEffectiveDate || saving) {
			return;
		}
		setSaving(true);
		setError(null);
		try {
			for (const row of changedRows) {
				if (!row._selectedEffectiveDate) {
					setError(`Vui lòng chọn ngày áp dụng cho "${row.category_name}"`);
					return;
				}
				const response = await fetch("/api/account-rate-cards", {
					method: "POST",
					headers: { "Content-Type": "application/json", Accept: "application/json" },
					body: JSON.stringify({
						account_id: selectedAccountId,
						category_id: row.category_id,
						unit_rate: toCreateMoneyValue(row._unitRateInput),
						surcharge: toCreateMoneyValue(row._surchargeInput),
						effective_date: row._selectedEffectiveDate,
					}),
				});
				if (!response.ok) {
					const payload = (await response.json().catch(() => ({}))) as { detail?: string };
					setError(payload.detail ?? `Không lưu được loại mặt hàng "${row.category_name}"`);
					return;
				}
			}
			await loadRateCards(selectedAccountId);
			toast.success("Đã lưu bảng giá cước");
		} catch {
			setError("Không thể kết nối máy chủ");
		} finally {
			setSaving(false);
		}
	}, [changedRows, hasMissingEffectiveDate, isViewingSelf, loadRateCards, saving, selectedAccountId]);

	const disableInputs = accountsLoading || rateCardsLoading || saving || isViewingSelf;
	/** Bật nút lưu: không gộp `saving` — khi đang lưu vẫn cần hiển thị trạng thái "Đang lưu". */
	const saveAllowed =
		!isViewingSelf &&
		selectedAccountId.length > 0 &&
		changedRows.length > 0 &&
		!hasMissingEffectiveDate &&
		!accountsLoading &&
		!rateCardsLoading;

	const moneyCellSx = {
		maxWidth: 220,
		minWidth: 220,
		verticalAlign: "middle",
		width: 220,
	} as const;

	const dateCellSx = {
		maxWidth: 220,
		minWidth: 220,
		textAlign: "center",
		verticalAlign: "middle",
		width: 220,
	} as const;

	const moneyInputSx = {
		"& .MuiOutlinedInput-input": { textAlign: "right" },
		width: "100%",
	} as const;

	return (
		<Box
			sx={{
				maxWidth: "var(--Content-maxWidth)",
				m: "var(--Content-margin)",
				p: "var(--Content-padding)",
				width: "var(--Content-width)",
			}}
		>
			<Stack spacing={3}>
				<Typography variant="h4">Bảng giá cước</Typography>
				<Card sx={{ p: 2 }}>
					<Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "flex-end" } }}>
						<FormControl fullWidth sx={{ maxWidth: { md: 420 } }}>
							<Select
								disabled={accountsLoading || accountOptions.length === 0}
								label="Tài khoản"
								labelId="rate-account-select-label"
								onChange={(event) => {
									setSelectedAccountId(String(event.target.value));
								}}
								value={selectedAccountId}
							>
								{accountOptions.map((account) => (
									<Option key={account.id} value={account.id}>
										{account.full_name} ({account.email})
									</Option>
								))}
							</Select>
						</FormControl>
						<Button
							disabled={saving || !saveAllowed}
							onClick={() => void handleSave()}
							startIcon={saving ? <CircularProgress color="inherit" size={16} /> : null}
							variant="contained"
						>
							{saving ? "Đang lưu" : "Lưu thay đổi"}
						</Button>
					</Stack>
					{viewerAccount?.role === "user_level_2" ? (
						<Alert severity="warning" sx={{ mt: 2 }}>
							Tài khoản hiện tại không có account con để thiết lập bảng giá.
						</Alert>
					) : null}
					{isViewingSelf ? (
						<Alert severity="info" sx={{ mt: 2 }}>
							Bạn đang xem bảng giá của chính mình. Thông tin này được đặt bởi người quản lý của bạn.
						</Alert>
					) : null}
					{error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
				</Card>

				<Card sx={{ position: "relative" }}>
					{rateCardsLoading ? <LinearProgress sx={{ left: 0, position: "absolute", right: 0, top: 0, zIndex: 2 }} /> : null}
					<TableContainer
						sx={{
							overflowX: "auto",
							width: "100%",
						}}
					>
						<Table sx={{ width: "100%" }}>
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
										sx={{
											...dashboardTableHeadCellSx(theme),
											minWidth: 220,
										}}
									>
										Loại mặt hàng
									</TableCell>
									<TableCell
										align="right"
										sx={{
											...dashboardTableHeadCellSx(theme),
											maxWidth: 220,
											minWidth: 220,
											width: 220,
										}}
									>
										Giá cước (VNĐ/Kg)
									</TableCell>
									<TableCell
										align="right"
										sx={{
											...dashboardTableHeadCellSx(theme),
											maxWidth: 220,
											minWidth: 220,
											width: 220,
										}}
									>
										Phụ thu (VNĐ)
									</TableCell>
									<TableCell
										align="center"
										sx={{
											...dashboardTableHeadCellSx(theme),
											maxWidth: 220,
											minWidth: 220,
											width: 220,
										}}
									>
										Ngày áp dụng
									</TableCell>
									<TableCell
										align="center"
										sx={{
											...dashboardTableHeadCellSx(theme),
											maxWidth: 112,
											minWidth: 112,
											width: 112,
										}}
									>
									</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{rows.map((row, index) => (
									<TableRow key={row.category_id}>
										<TableCell align="center">{index + 1}</TableCell>
										<TableCell>
											<Typography variant="body2">{row.category_name}</Typography>
										</TableCell>
										<TableCell align="right" sx={moneyCellSx}>
											<OutlinedInput
												disabled={disableInputs || !selectedAccountId}
												fullWidth
												inputMode="decimal"
												onChange={(event) => {
													onCellChange(row.category_id, "_unitRateInput", event.target.value);
												}}
												placeholder="0"
												sx={moneyInputSx}
												value={formatMoneyDisplay(row._unitRateInput)}
											/>
										</TableCell>
										<TableCell align="right" sx={moneyCellSx}>
											<OutlinedInput
												disabled={disableInputs || !selectedAccountId}
												fullWidth
												inputMode="decimal"
												onChange={(event) => {
													onCellChange(row.category_id, "_surchargeInput", event.target.value);
												}}
												placeholder="0"
												sx={moneyInputSx}
												value={formatMoneyDisplay(row._surchargeInput)}
											/>
										</TableCell>
										<TableCell align="center" sx={dateCellSx}>
											{changedRowIds.has(row.category_id) ? (
												<DatePicker
													closeOnSelect
													disablePast
													format="DD/MM/YYYY"
													minDate={dayjs().startOf("day")}
													onChange={(value) => {
														onEffectiveDateChange(row.category_id, toUtcStartOfDayIso(value));
														// Đóng sau tick hiện tại để tránh focus vào input kích hoạt mở lại lịch
														queueMicrotask(() => {
															setOpenDatePickerCategoryId(null);
														});
													}}
													onClose={() => {
														setOpenDatePickerCategoryId((cur) =>
															cur === row.category_id ? null : cur
														);
													}}
													onOpen={() => {
														setOpenDatePickerCategoryId(row.category_id);
													}}
													open={openDatePickerCategoryId === row.category_id}
													slotProps={{
														textField: {
															fullWidth: true,
															inputProps: { readOnly: true },
															// Chỉ mở bằng click — không dùng onFocus: sau khi chọn ngày focus
															// quay lại input và sẽ mở lại lịch nếu onFocus gọi setOpen.
															onClick: () => {
																setOpenDatePickerCategoryId(row.category_id);
															},
															sx: {
																width: "100%",
																"& .MuiOutlinedInput-input": { textAlign: "center" },
																"& .MuiOutlinedInput-root": { width: "100%" },
															},
														},
													}}
													slots={{
														openPickerIcon: () => null,
													}}
													value={row._selectedEffectiveDate ? dayjs(row._selectedEffectiveDate) : null}
												/>
											) : (
												<Typography component="span" variant="body2">
													{row.effective_date ? dayjs(row.effective_date).format("DD/MM/YYYY") : "—"}
												</Typography>
											)}
										</TableCell>
									<TableCell align="center" sx={{ verticalAlign: "middle", whiteSpace: "nowrap" }}>
										<Stack alignItems="center" direction="row" justifyContent="center" spacing={0.5}>
											<Tooltip title="Hoàn tác chỉnh sửa">
												<span>
													<IconButton
														aria-label="Hoàn tác chỉnh sửa"
														color="primary"
														disabled={
															!changedRowIds.has(row.category_id) ||
															disableInputs ||
															rateCardsLoading
														}
														onClick={() => handleUndoRow(row.category_id)}
													>
														<ArrowCounterClockwiseIcon />
													</IconButton>
												</span>
											</Tooltip>
											<Tooltip title="Xem lịch sử theo ngày áp dụng">
												<IconButton
													aria-label="Xem lịch sử giá"
													color="primary"
													disabled={!selectedAccountId || rateCardsLoading}
													onClick={() => {
														setHistoryModal({
															categoryId: row.category_id,
															categoryName: row.category_name,
														});
													}}
												>
													<EyeIcon />
												</IconButton>
											</Tooltip>
										</Stack>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					</TableContainer>
					{rows.length === 0 ? (
						<Typography color="text.secondary" sx={{ p: 3, textAlign: "center" }} variant="body2">
							{accountsLoading ? "Đang tải..." : "Không có dữ liệu"}
						</Typography>
					) : null}
				</Card>
			</Stack>
			<RateCardCategoryHistoryModal
				accountId={selectedAccountId}
				categoryId={historyModal?.categoryId ?? ""}
				categoryTitle={historyModal?.categoryName ?? ""}
				onClose={() => setHistoryModal(null)}
				open={historyModal !== null}
			/>
		</Box>
	);
}
