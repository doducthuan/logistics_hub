"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { EyeIcon } from "@phosphor-icons/react/dist/ssr/Eye";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/ssr/EyeSlash";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

import type { AccountCreatePayload, AccountItem } from "./types";

/** Dấu * bắt buộc trên nhãn — luôn màu đỏ (error) */
const requiredLabelFormControlSx = {
	"& .MuiFormLabel-asterisk": { color: "error.main" },
	"& .MuiInputLabel-asterisk": { color: "error.main" },
} as const;

interface CreateFormState {
	full_name: string;
	email: string;
	password: string;
	phone: string;
	description: string;
}

function defaultForm(): CreateFormState {
	return {
		full_name: "",
		email: "",
		password: "",
		phone: "",
		description: "",
	};
}

export interface AccountCreateModalProps {
	open: boolean;
	currentAccount: AccountItem;
	onClose: () => void;
	onCreated: () => Promise<void>;
}

export function AccountCreateModal({
	open,
	currentAccount,
	onClose,
	onCreated,
}: AccountCreateModalProps): React.JSX.Element {
	const [form, setForm] = React.useState<CreateFormState>(defaultForm);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [showPassword, setShowPassword] = React.useState(false);

	React.useEffect(() => {
		if (!open) {
			setForm(defaultForm());
			setError(null);
			setLoading(false);
			setShowPassword(false);
		}
	}, [open]);

	const resolvedRole: AccountItem["role"] =
		currentAccount.role === "admin" ? "user_level_1" : "user_level_2";

	const isValid = React.useMemo(() => {
		if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
			return false;
		}
		if (form.password.trim().length < 8) {
			return false;
		}
		return true;
	}, [form]);

	const handleSubmit = React.useCallback(async () => {
		if (!isValid || loading) {
			return;
		}

		const payload: AccountCreatePayload = {
			full_name: form.full_name.trim(),
			email: form.email.trim(),
			password: form.password,
			role: resolvedRole,
			parent_id: currentAccount.id,
		};

		if (form.phone.trim()) {
			payload.phone = form.phone.trim();
		}
		if (form.description.trim()) {
			payload.description = form.description.trim();
		}
		setLoading(true);
		setError(null);

		try {
			const res = await fetch("/api/accounts", {
				method: "POST",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify(payload),
			});
			const data = (await res.json().catch(() => ({}))) as { detail?: string };

			if (!res.ok) {
				setError(data.detail ?? "Tạo tài khoản thất bại");
				return;
			}

			await onCreated();
			onClose();
		} catch {
			setError("Không thể kết nối máy chủ");
		} finally {
			setLoading(false);
		}
	}, [currentAccount.id, form, isValid, loading, onClose, onCreated, resolvedRole]);

	return (
		<Dialog
			fullWidth
			maxWidth="md"
			onClose={onClose}
			open={open}
			sx={{ "& .MuiDialog-paper": { maxWidth: "760px" } }}
		>
			<DialogTitle
				component="div"
				sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", pr: 1.5 }}
			>
				<Typography component="span" variant="h6">
					Tạo tài khoản
				</Typography>
				<IconButton onClick={onClose}>
					<XIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers>
				<Stack spacing={2}>
					{error ? <Alert severity="error">{error}</Alert> : null}
					<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
						<FormControl fullWidth required sx={requiredLabelFormControlSx}>
							<InputLabel>Họ và tên</InputLabel>
							<OutlinedInput
								label="Họ và tên"
								onChange={(event) => {
									setForm((prev) => ({ ...prev, full_name: event.target.value }));
								}}
								value={form.full_name}
							/>
						</FormControl>
						<FormControl fullWidth required sx={requiredLabelFormControlSx}>
							<InputLabel>Email</InputLabel>
							<OutlinedInput
								label="Email"
								onChange={(event) => {
									setForm((prev) => ({ ...prev, email: event.target.value }));
								}}
								type="email"
								value={form.email}
							/>
						</FormControl>
					</Stack>
					<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
						<FormControl fullWidth required sx={requiredLabelFormControlSx}>
							<InputLabel>Mật khẩu</InputLabel>
							<OutlinedInput
								label="Mật khẩu"
								onChange={(event) => {
									setForm((prev) => ({ ...prev, password: event.target.value }));
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
						</FormControl>
						<FormControl fullWidth>
							<InputLabel>Số điện thoại</InputLabel>
							<OutlinedInput
								label="Số điện thoại"
								onChange={(event) => {
									setForm((prev) => ({ ...prev, phone: event.target.value }));
								}}
								value={form.phone}
							/>
						</FormControl>
					</Stack>
					<FormControl fullWidth>
						<InputLabel>Mô tả</InputLabel>
						<OutlinedInput
							label="Mô tả"
							multiline
							minRows={3}
							onChange={(event) => {
								setForm((prev) => ({ ...prev, description: event.target.value }));
							}}
							value={form.description}
						/>
					</FormControl>
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button color="secondary" onClick={onClose}>
					Hủy
				</Button>
				<Button disabled={!isValid || loading} onClick={handleSubmit} variant="contained">
					{loading ? "Đang tạo..." : "Tạo mới"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
