"use client";

import * as React from "react";
import RouterLink from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Divider from "@mui/material/Divider";
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
import { signInWithOAuth, signInWithPassword } from "@/lib/custom-auth/actions";
import { getSafeCallbackPath } from "@/lib/safe-callback-url";
import { useAuth } from "@/components/auth/custom/auth-context";
import { DynamicLogo } from "@/components/core/logo";
import { toast } from "@/components/core/toaster";

interface OAuthProvider {
	id: "google" | "discord";
	name: string;
	logo: string;
}

const oAuthProviders = [
	{ id: "google", name: "Google", logo: "/assets/logo-google.svg" },
	{ id: "discord", name: "Discord", logo: "/assets/logo-discord.svg" },
] satisfies OAuthProvider[];

const schema = zod.object({
	email: zod.string().min(1, { message: "Email is required" }).email(),
	password: zod.string().min(1, { message: "Password is required" }),
});

type Values = zod.infer<typeof schema>;

const defaultValues = { email: "", password: "" } satisfies Values;

export interface SignInFormProps {
	/**
	 * `full` — template demo (OAuth, sign up, demo credentials alert).
	 * `app` — production login: card layout, no OAuth/sign-up; use with `callbackUrl` from the server.
	 */
	variant?: "full" | "app";
	/** For `variant="app"` only — avoids useSearchParams (reduces dev/HMR churn). */
	callbackUrl?: string | null;
}

export function SignInForm({ variant = "full", callbackUrl = null }: SignInFormProps): React.JSX.Element {
	const router = useRouter();
	const auth = useAuth();
	const [showPassword, setShowPassword] = React.useState<boolean>(false);
	const [isPending, setIsPending] = React.useState<boolean>(false);

	const {
		control,
		handleSubmit,
		setError,
		formState: { errors },
	} = useForm<Values>({ defaultValues, resolver: zodResolver(schema) });

	const onAuth = React.useCallback(async (providerId: OAuthProvider["id"]): Promise<void> => {
		setIsPending(true);

		const { error } = await signInWithOAuth({ provider: providerId });

		if (error) {
			setIsPending(false);
			toast.error(error);
			return;
		}

		setIsPending(false);

		// Redirect to OAuth provider
	}, []);

	const onSubmit = React.useCallback(
		async (values: Values): Promise<void> => {
			setIsPending(true);

			const { data, error } = await signInWithPassword(values);

			if (error) {
				setError("root", { type: "server", message: error });
				setIsPending(false);
				return;
			}

			auth.setUser(data!.user);

			if (variant === "app") {
				router.push(getSafeCallbackPath(callbackUrl));
			}

			router.refresh();
		},
		[auth, callbackUrl, router, setError, variant]
	);

	const passwordAdornment = (
		<InputAdornment position="end">
			<IconButton
				aria-label="Toggle password visibility"
				edge="end"
				onClick={(): void => {
					setShowPassword((prev) => !prev);
				}}
			>
				{showPassword ? <EyeIcon fontSize="var(--icon-fontSize-md)" /> : <EyeSlashIcon fontSize="var(--icon-fontSize-md)" />}
			</IconButton>
		</InputAdornment>
	);

	const emailField = (
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
	);

	const passwordField = (
		<Controller
			control={control}
			name="password"
			render={({ field }) => (
				<FormControl error={Boolean(errors.password)}>
					<InputLabel>Password</InputLabel>
					<OutlinedInput
						{...field}
						autoComplete="current-password"
						endAdornment={passwordAdornment}
						type={showPassword ? "text" : "password"}
					/>
					{errors.password ? <FormHelperText>{errors.password.message}</FormHelperText> : null}
				</FormControl>
			)}
		/>
	);

	if (variant === "app") {
		return (
			<Stack spacing={4}>
				<div>
					<Box component={RouterLink} href={paths.home} sx={{ display: "inline-block", fontSize: 0 }}>
						<DynamicLogo colorDark="light" colorLight="dark" height={32} width={122} />
					</Box>
				</div>
				<Card>
					<CardHeader
						subheader={
							<Typography color="text.secondary" variant="body2">
								Sign in to access the logistics hub.
							</Typography>
						}
						title="Sign in"
					/>
					<CardContent>
						<form onSubmit={handleSubmit(onSubmit)}>
							<Stack spacing={2}>
								{emailField}
								{passwordField}
								{errors.root ? <Alert color="error">{errors.root.message}</Alert> : null}
								<Button disabled={isPending} type="submit" variant="contained">
									Sign in
								</Button>
							</Stack>
						</form>
						<Box sx={{ mt: 2 }}>
							<Link component={RouterLink} href={paths.forgotPassword} variant="subtitle2">
								Forgot password?
							</Link>
						</Box>
					</CardContent>
				</Card>
			</Stack>
		);
	}

	return (
		<Stack spacing={4}>
			<div>
				<Box component={RouterLink} href={paths.home} sx={{ display: "inline-block", fontSize: 0 }}>
					<DynamicLogo colorDark="light" colorLight="dark" height={32} width={122} />
				</Box>
			</div>
			<Stack spacing={1}>
				<Typography variant="h5">Sign in</Typography>
				<Typography color="text.secondary" variant="body2">
					Don&apos;t have an account?{" "}
					<Link component={RouterLink} href={paths.auth.custom.signUp} variant="subtitle2">
						Sign up
					</Link>
				</Typography>
			</Stack>
			<Stack spacing={3}>
				<Stack spacing={2}>
					{oAuthProviders.map(
						(provider): React.JSX.Element => (
							<Button
								color="secondary"
								disabled={isPending}
								endIcon={<Box alt="" component="img" height={24} src={provider.logo} width={24} />}
								key={provider.id}
								onClick={(): void => {
									onAuth(provider.id).catch(() => {
										// noop
									});
								}}
								variant="outlined"
							>
								Continue with {provider.name}
							</Button>
						)
					)}
				</Stack>
				<Divider>or</Divider>
				<Stack spacing={2}>
					<form onSubmit={handleSubmit(onSubmit)}>
						<Stack spacing={2}>
							{emailField}
							{passwordField}
							{errors.root ? <Alert color="error">{errors.root.message}</Alert> : null}
							<Button disabled={isPending} type="submit" variant="contained">
								Sign in
							</Button>
						</Stack>
					</form>
					<div>
						<Link component={RouterLink} href={paths.auth.custom.resetPassword} variant="subtitle2">
							Forgot password?
						</Link>
					</div>
				</Stack>
			</Stack>
			<Alert color="warning">
				Use{" "}
				<Typography component="span" sx={{ fontWeight: 700 }} variant="inherit">
					sofia@devias.io
				</Typography>{" "}
				with password{" "}
				<Typography component="span" sx={{ fontWeight: 700 }} variant="inherit">
					Secret1
				</Typography>
			</Alert>
		</Stack>
	);
}
