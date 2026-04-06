"use server";

import { cookies } from "next/headers";

import {
	fetchAccountByAccessToken,
	loginAccessToken,
	mapAccountToUser,
	requestPasswordRecoveryEmail,
	submitPasswordReset,
} from "./api";
import type { User } from "./types";

/** Match backend default: ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 8 */
const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 24 * 8 * 60;

export interface SignUpParams {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
}

export interface SignInWithOAuthParams {
	provider: "google" | "discord";
}

export interface SignInWithPasswordParams {
	email: string;
	password: string;
}

export interface ResetPasswordParams {
	email: string;
}

export async function signUp(_: SignUpParams): Promise<{ data?: { user: User }; error?: string }> {
	return { error: "Registration is not enabled" };
}

export async function signInWithOAuth(_: SignInWithOAuthParams): Promise<{ error?: string }> {
	return { error: "Social authentication not implemented" };
}

export async function signInWithPassword(
	params: SignInWithPasswordParams
): Promise<{ data?: { user: User }; error?: string }> {
	const { email, password } = params;

	let tokenResult;
	try {
		tokenResult = await loginAccessToken(email, password);
	} catch {
		return { error: "Cannot reach authentication server. Check NEXT_PUBLIC_API_URL." };
	}

	if ("detail" in tokenResult) {
		return { error: tokenResult.detail };
	}

	const cookieStore = await cookies();
	cookieStore.set("access_token", tokenResult.access_token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
	});

	const account = await fetchAccountByAccessToken(tokenResult.access_token);
	if (!account) {
		cookieStore.delete("access_token");
		return { error: "Could not load your profile after login." };
	}

	return { data: { user: mapAccountToUser(account) } };
}

export async function resetPassword(params: ResetPasswordParams): Promise<{ error?: string }> {
	let result;
	try {
		result = await requestPasswordRecoveryEmail(params.email);
	} catch {
		return { error: "Cannot reach authentication server. Check NEXT_PUBLIC_API_URL." };
	}

	if ("error" in result) {
		return { error: result.error };
	}

	return {};
}

export interface CompletePasswordResetParams {
	token: string;
	newPassword: string;
}

export async function completePasswordReset(
	params: CompletePasswordResetParams
): Promise<{ error?: string }> {
	let result;
	try {
		result = await submitPasswordReset(params.token, params.newPassword);
	} catch {
		return { error: "Không thể kết nối máy chủ. Kiểm tra NEXT_PUBLIC_API_URL." };
	}

	if ("error" in result) {
		return { error: result.error };
	}

	return {};
}

export async function signOut(): Promise<{ error?: string }> {
	const cookieStore = await cookies();
	cookieStore.delete("access_token");

	return {};
}
