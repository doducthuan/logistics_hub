"use client";

import * as React from "react";
import RouterLink from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Controller, useForm } from "react-hook-form";
import { z as zod } from "zod";

import { paths } from "@/paths";
import { resetPassword } from "@/lib/custom-auth/actions";
import { DynamicLogo } from "@/components/core/logo";

const schema = zod.object({ email: zod.string().min(1, { message: "Email is required" }).email() });

type Values = zod.infer<typeof schema>;

const defaultValues = { email: "" } satisfies Values;

export interface ResetPasswordFormProps {
	/** `split` — original template (e.g. /auth/custom/reset-password). `card` — /forgot-password centered card. */
	variant?: "split" | "card";
}

export function ResetPasswordForm({ variant = "split" }: ResetPasswordFormProps): React.JSX.Element {
	const [isPending, setIsPending] = React.useState<boolean>(false);
	const [submitted, setSubmitted] = React.useState<boolean>(false);

	const {
		control,
		handleSubmit,
		setError,
		formState: { errors },
	} = useForm<Values>({ defaultValues, resolver: zodResolver(schema) });

	const onSubmit = React.useCallback(
		async (values: Values): Promise<void> => {
			setIsPending(true);

			const { error } = await resetPassword(values);

			if (error) {
				setError("root", { type: "server", message: error });
				setIsPending(false);
				return;
			}

			setIsPending(false);
			if (variant === "card") {
				setSubmitted(true);
			}
		},
		[setError, variant]
	);

	const logo = (
		<div>
			<Box component={RouterLink} href={paths.home} sx={{ display: "inline-block", fontSize: 0 }}>
				<DynamicLogo colorDark="light" colorLight="dark" height={32} width={122} />
			</Box>
		</div>
	);

	const formBody = (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Stack spacing={2}>
				<Controller
					control={control}
					name="email"
					render={({ field }) => (
						<FormControl error={Boolean(errors.email)}>
							<InputLabel>Email address</InputLabel>
							<OutlinedInput {...field} autoComplete="email" type="email" />
							{errors.email ? <FormHelperText>{errors.email.message}</FormHelperText> : null}
						</FormControl>
					)}
				/>
				{errors.root ? <Alert color="error">{errors.root.message}</Alert> : null}
				<Button disabled={isPending} type="submit" variant="contained">
					Send recovery link
				</Button>
			</Stack>
		</form>
	);

	if (variant === "card") {
		return (
			<Stack spacing={4}>
				{logo}
				<Card>
					<CardHeader
						subheader={
							<Typography color="text.secondary" variant="body2">
								Enter your email and we&apos;ll send recovery instructions if an account exists.
							</Typography>
						}
						title="Forgot password"
					/>
					<CardContent>
						{submitted ? (
							<Alert severity="success">
								If that email is registered, we sent a password recovery link. You can close this page or return to
								sign in.
							</Alert>
						) : (
							formBody
						)}
						<Box sx={{ mt: 2 }}>
							<Link component={RouterLink} href={paths.login} variant="subtitle2">
								Back to sign in
							</Link>
						</Box>
					</CardContent>
				</Card>
			</Stack>
		);
	}

	return (
		<Stack spacing={4}>
			{logo}
			<Typography variant="h5">Reset password</Typography>
			{formBody}
		</Stack>
	);
}
