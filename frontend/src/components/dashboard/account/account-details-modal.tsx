"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { EyeIcon } from "@phosphor-icons/react/dist/ssr/Eye";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/ssr/EyeSlash";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

import { Option } from "@/components/core/option";
import { dayjs } from "@/lib/dayjs";

import { AccountL2ManagedSection } from "./account-l2-managed-section";
import type { AccountItem } from "./types";

const boldInputLabelFormControlSx = {
	"& .MuiInputLabel-root": { fontWeight: 600 },
} as const;

const requiredLabelFormControlSx = {
	...boldInputLabelFormControlSx,
	"& .MuiFormLabel-asterisk": { color: "error.main" },
	"& .MuiInputLabel-asterisk": { color: "error.main" },
} as const;

export interface AccountDetailsModalProps {
	open: boolean;
	account: AccountItem | null;
	/** User đang đăng nhập (để hiển thị bảng L2 khi admin xem User cấp 1). */
	viewerAccount: AccountItem | null;
	allScopeAccounts: AccountItem[];
	onClose: () => void;
	onUpdated: () => Promise<void>;
}

interface EditState {
	full_name: string;
	email: string;
	password: string;
	phone: string;
	description: string;
	is_active: boolean;
}

function buildEditState(account: AccountItem): EditState {
	return {
		full_name: account.full_name ?? "",
		email: account.email ?? "",
		password: "",
		phone: account.phone ?? "",
		description: account.description ?? "",
		is_active: account.is_active,
	};
}

export function AccountDetailsModal({
	open,
	account,
	viewerAccount,
	allScopeAccounts,
	onClose,
	onUpdated,
}: AccountDetailsModalProps): React.JSX.Element {
	const [form, setForm] = React.useState<EditState | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [showPassword, setShowPassword] = React.useState(false);
	const [creatorName, setCreatorName] = React.useState<string>("");
	const [updaterName, setUpdaterName] = React.useState<string>("");
	React.useEffect(() => {
		if (account) {
			setForm(buildEditState(account));
			setError(null);
			setLoading(false);
			setShowPassword(false);
		}
	}, [account]);

	const accountNameById = React.useMemo(() => {
		const map = new Map<string, string>();
		for (const item of allScopeAccounts) {
			map.set(item.id, item.full_name);
		}
		return map;
	}, [allScopeAccounts]);

	React.useEffect(() => {
		let active = true;
		async function resolveNames(): Promise<void> {
			const createdId = account?.created_by_id ?? null;
			const updatedId = account?.updated_by_id ?? null;
			const ids = [...new Set([createdId, updatedId].filter(Boolean) as string[])];
			const nameById = new Map<string, string>();

			for (const id of ids) {
				const localName = accountNameById.get(id);
				if (localName) {
					nameById.set(id, localName);
					continue;
				}

				const res = await fetch(`/api/accounts/${encodeURIComponent(id)}`, { cache: "no-store" });
				if (!res.ok) {
					nameById.set(id, "");
					continue;
				}
				const payload = (await res.json()) as { full_name?: string };
				nameById.set(id, payload.full_name ?? "");
			}

			if (!active) {
				return;
			}
			setCreatorName(createdId ? (nameById.get(createdId) ?? "") : "");
			setUpdaterName(updatedId ? (nameById.get(updatedId) ?? "") : "");
		}

		void resolveNames();

		return () => {
			active = false;
		};
	}, [account?.created_by_id, account?.updated_by_id, accountNameById]);

	const isValid = React.useMemo(() => {
		if (!form) {
			return false;
		}
		if (!form.full_name.trim() || !form.email.trim()) {
			return false;
		}
		const pwd = form.password.trim();
		if (pwd.length > 0 && pwd.length < 8) {
			return false;
		}
		return true;
	}, [form]);

	const handleSave = React.useCallback(async () => {
		if (!account || !form || loading) {
			return;
		}
		setLoading(true);
		setError(null);

		try {
			const body: Record<string, unknown> = {
				full_name: form.full_name.trim(),
				email: form.email.trim(),
				phone: form.phone.trim() || null,
				description: form.description.trim() || null,
				is_active: form.is_active,
			};
			const newPassword = form.password.trim();
			if (newPassword.length > 0) {
				body.password = newPassword;
			}

			const res = await fetch(`/api/accounts/${encodeURIComponent(account.id)}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify(body),
			});
			const payload = (await res.json().catch(() => ({}))) as { detail?: string };
			if (!res.ok) {
				setError(payload.detail ?? "Cập nhật thất bại");
				return;
			}

			await onUpdated();
			onClose();
		} catch {
			setError("Không thể kết nối máy chủ");
		} finally {
			setLoading(false);
		}
	}, [account, form, loading, onClose, onUpdated]);

	return (
		<Dialog
			fullWidth
			maxWidth="md"
			onClose={onClose}
			open={open}
			sx={{ "& .MuiDialog-paper": { maxHeight: "95vh", width: "100%", maxWidth: "760px" } }}
		>
			<DialogTitle
				component="div"
				sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", pr: 1.5 }}
			>
				<Typography component="span" sx={{ fontWeight: 600 }} variant="h6">
					Chi tiết tài khoản
				</Typography>
				<IconButton onClick={onClose}>
					<XIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 3, minHeight: 0, overflowX: "hidden" }}>
				{error ? <Alert severity="error">{error}</Alert> : null}
				{form ? (
					<Stack spacing={2} sx={{ maxWidth: "100%", minWidth: 0 }}>
						<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
							<FormControl fullWidth required sx={requiredLabelFormControlSx}>
								<InputLabel>Họ và tên</InputLabel>
								<OutlinedInput
									label="Họ và tên"
									onChange={(event) => {
										setForm((prev) => (prev ? { ...prev, full_name: event.target.value } : prev));
									}}
									value={form.full_name}
								/>
							</FormControl>
							<FormControl fullWidth required sx={requiredLabelFormControlSx}>
								<InputLabel>Email</InputLabel>
								<OutlinedInput
									label="Email"
									onChange={(event) => {
										setForm((prev) => (prev ? { ...prev, email: event.target.value } : prev));
									}}
									type="email"
									value={form.email}
								/>
							</FormControl>
						</Stack>
						<FormControl fullWidth sx={boldInputLabelFormControlSx}>
							<InputLabel>Mật khẩu mới</InputLabel>
							<OutlinedInput
								label="Mật khẩu mới"
								onChange={(event) => {
									setForm((prev) => (prev ? { ...prev, password: event.target.value } : prev));
								}}
								endAdornment={
									<InputAdornment position="end">
										<IconButton
											edge="end"
											onClick={() => {
												setShowPassword((prev) => !prev);
											}}
										>
											{showPassword ? <EyeSlashIcon /> : <EyeIcon />}
										</IconButton>
									</InputAdornment>
								}
								type={showPassword ? "text" : "password"}
								value={form.password}
							/>
							<FormHelperText>Để trống nếu không đổi mật khẩu</FormHelperText>
						</FormControl>
						<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
							<FormControl fullWidth sx={boldInputLabelFormControlSx}>
								<InputLabel>Số điện thoại</InputLabel>
								<OutlinedInput
									label="Số điện thoại"
									onChange={(event) => {
										setForm((prev) => (prev ? { ...prev, phone: event.target.value } : prev));
									}}
									value={form.phone}
								/>
							</FormControl>
							<FormControl fullWidth sx={boldInputLabelFormControlSx}>
								<InputLabel>Trạng thái</InputLabel>
								<Select
									label="Trạng thái"
									onChange={(event) => {
										setForm((prev) =>
											prev ? { ...prev, is_active: event.target.value === "active" } : prev
										);
									}}
									value={form.is_active ? "active" : "inactive"}
								>
									<Option value="active">Đang hoạt động</Option>
									<Option value="inactive">Tạm khóa</Option>
								</Select>
							</FormControl>
						</Stack>
						<FormControl fullWidth sx={boldInputLabelFormControlSx}>
							<InputLabel>Mô tả</InputLabel>
							<OutlinedInput
								label="Mô tả"
								minRows={3}
								multiline
								onChange={(event) => {
									setForm((prev) => (prev ? { ...prev, description: event.target.value } : prev));
								}}
								value={form.description}
							/>
						</FormControl>
						{viewerAccount?.role === "admin" && account?.role === "user_level_1" && account ? (
							<AccountL2ManagedSection
								key={account.id}
								enabled={open}
								parentId={account.id}
							/>
						) : null}
					</Stack>
				) : (
					<Box sx={{ py: 2 }}>
						<Typography color="text.secondary" variant="body2">
							Không có dữ liệu tài khoản.
						</Typography>
					</Box>
				)}

				<Stack spacing={2} sx={{ maxWidth: "100%", minWidth: 0 }}>
					<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
								<FormControl fullWidth sx={boldInputLabelFormControlSx}>
									<InputLabel shrink>Ngày tạo</InputLabel>
							<OutlinedInput
								inputProps={{ readOnly: true, tabIndex: -1 }}
								label="Ngày tạo"
								notched
								readOnly
								sx={{ "& .MuiInputBase-input": { cursor: "default" } }}
								value={account?.created_at ? dayjs(account.created_at).format("HH:mm DD/MM/YYYY") : ""}
							/>
						</FormControl>
								<FormControl fullWidth sx={boldInputLabelFormControlSx}>
									<InputLabel shrink>Người tạo</InputLabel>
							<OutlinedInput
								inputProps={{ readOnly: true, tabIndex: -1 }}
								label="Người tạo"
								notched
								readOnly
								sx={{ "& .MuiInputBase-input": { cursor: "default" } }}
								value={creatorName || "Không rõ"}
							/>
						</FormControl>
					</Stack>
					<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
								<FormControl fullWidth sx={boldInputLabelFormControlSx}>
									<InputLabel shrink>Ngày cập nhật</InputLabel>
							<OutlinedInput
								inputProps={{ readOnly: true, tabIndex: -1 }}
								label="Ngày cập nhật"
								notched
								readOnly
								sx={{ "& .MuiInputBase-input": { cursor: "default" } }}
								value={account?.updated_at ? dayjs(account.updated_at).format("HH:mm DD/MM/YYYY") : ""}
							/>
						</FormControl>
								<FormControl fullWidth sx={boldInputLabelFormControlSx}>
									<InputLabel shrink>Người cập nhật</InputLabel>
							<OutlinedInput
								inputProps={{ readOnly: true, tabIndex: -1 }}
								label="Người cập nhật"
								notched
								readOnly
								sx={{ "& .MuiInputBase-input": { cursor: "default" } }}
								value={updaterName || "Không rõ"}
							/>
						</FormControl>
					</Stack>
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button color="secondary" onClick={onClose}>
					Đóng
				</Button>
				<Button disabled={!account || !form || !isValid || loading} onClick={handleSave} variant="contained">
					{loading ? "Đang lưu..." : "Cập nhật"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
