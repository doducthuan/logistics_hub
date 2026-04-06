"use client";

import * as React from "react";
import RouterLink from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { EyeIcon } from "@phosphor-icons/react/dist/ssr/Eye";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/ssr/EyeSlash";
import { Controller, useForm } from "react-hook-form";
import { z as zod } from "zod";

import { paths } from "@/paths";
import { completePasswordReset } from "@/lib/custom-auth/actions";
import { DynamicLogo } from "@/components/core/logo";

const schema = zod
	.object({
		password: zod.string().min(8, { message: "Mật khẩu tối thiểu 8 ký tự" }).max(128),
		confirm: zod.string().min(1, { message: "Nhập lại mật khẩu" }),
	})
	.refine((data) => data.password === data.confirm, {
		message: "Mật khẩu nhập lại không khớp",
		path: ["confirm"],
	});

type Values = zod.infer<typeof schema>;

const defaultValues = { password: "", confirm: "" } satisfies Values;

export function SetNewPasswordForm(): React.JSX.Element {
	const searchParams = useSearchParams();
	const token = searchParams.get("token")?.trim() ?? "";

	const [isPending, setIsPending] = React.useState(false);
	const [done, setDone] = React.useState(false);
	const [showPassword, setShowPassword] = React.useState(false);
	const [showConfirm, setShowConfirm] = React.useState(false);

	const {
		control,
		handleSubmit,
		setError,
		formState: { errors },
	} = useForm<Values>({ defaultValues, resolver: zodResolver(schema) });

	const onSubmit = React.useCallback(
		async (values: Values): Promise<void> => {
			if (!token) {
				setError("root", { type: "server", message: "Thiếu liên kết hợp lệ. Hãy mở lại email hoặc yêu cầu gửi lại." });
				return;
			}
			setIsPending(true);

			const { error } = await completePasswordReset({ token, newPassword: values.password });

			if (error) {
				setError("root", { type: "server", message: error });
				setIsPending(false);
				return;
			}

			setIsPending(false);
			setDone(true);
		},
		[setError, token]
	);

	const logo = (
		<Box component={RouterLink} href={paths.home} sx={{ display: "inline-block", fontSize: 0 }}>
			<DynamicLogo colorDark="light" colorLight="dark" height={32} width={122} />
		</Box>
	);

	if (!token) {
		return (
			<Stack spacing={4}>
				{logo}
				<Card>
					<CardHeader title="Liên kết không hợp lệ" />
					<CardContent>
						<Alert severity="warning">
							Không tìm thấy mã xác nhận. Hãy dùng nút trong email hoặc yêu cầu gửi lại email khôi phục mật khẩu.
						</Alert>
						<Box sx={{ mt: 2 }}>
							<Link component={RouterLink} href={paths.forgotPassword} variant="subtitle2">
								Gửi lại email khôi phục
							</Link>
							{" · "}
							<Link component={RouterLink} href={paths.login} variant="subtitle2">
								Đăng nhập
							</Link>
						</Box>
					</CardContent>
				</Card>
			</Stack>
		);
	}

	if (done) {
		return (
			<Stack spacing={4}>
				{logo}
				<Card>
					<CardHeader title="Đặt lại mật khẩu thành công" />
					<CardContent>
						<Alert severity="success">Bạn có thể đăng nhập bằng mật khẩu mới.</Alert>
						<Box sx={{ mt: 2 }}>
							<Button component={RouterLink} href={paths.login} variant="contained">
								Đến trang đăng nhập
							</Button>
						</Box>
					</CardContent>
				</Card>
			</Stack>
		);
	}

	return (
		<Stack spacing={4}>
			{logo}
			<Card>
				<CardHeader
					subheader={
						<Typography color="text.secondary" variant="body2">
							Nhập mật khẩu mới cho tài khoản của bạn (tối thiểu 8 ký tự).
						</Typography>
					}
					title="Đặt lại mật khẩu"
				/>
				<CardContent>
					<form onSubmit={handleSubmit(onSubmit)}>
						<Stack spacing={2}>
							<Controller
								control={control}
								name="password"
								render={({ field }) => (
									<FormControl error={Boolean(errors.password)}>
										<InputLabel>Mật khẩu mới</InputLabel>
										<OutlinedInput
											{...field}
											endAdornment={
												<InputAdornment position="end">
													<IconButton
														edge="end"
														onClick={() => {
															setShowPassword((p) => !p);
														}}
													>
														{showPassword ? <EyeSlashIcon /> : <EyeIcon />}
													</IconButton>
												</InputAdornment>
											}
											label="Mật khẩu mới"
											type={showPassword ? "text" : "password"}
										/>
										{errors.password ? <FormHelperText>{errors.password.message}</FormHelperText> : null}
									</FormControl>
								)}
							/>
							<Controller
								control={control}
								name="confirm"
								render={({ field }) => (
									<FormControl error={Boolean(errors.confirm)}>
										<InputLabel>Nhập lại mật khẩu</InputLabel>
										<OutlinedInput
											{...field}
											endAdornment={
												<InputAdornment position="end">
													<IconButton
														edge="end"
														onClick={() => {
															setShowConfirm((p) => !p);
														}}
													>
														{showConfirm ? <EyeSlashIcon /> : <EyeIcon />}
													</IconButton>
												</InputAdornment>
											}
											label="Nhập lại mật khẩu"
											type={showConfirm ? "text" : "password"}
										/>
										{errors.confirm ? <FormHelperText>{errors.confirm.message}</FormHelperText> : null}
									</FormControl>
								)}
							/>
							{errors.root ? <Alert color="error">{errors.root.message}</Alert> : null}
							<Button disabled={isPending} type="submit" variant="contained">
								{isPending ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
							</Button>
						</Stack>
					</form>
					<Box sx={{ mt: 2 }}>
						<Link component={RouterLink} href={paths.login} variant="subtitle2">
							Quay lại đăng nhập
						</Link>
					</Box>
				</CardContent>
			</Card>
		</Stack>
	);
}
