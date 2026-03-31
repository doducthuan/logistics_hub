"use server";

import { cookies } from "next/headers";

import { user } from "./data";
import type { User } from "./types";

function generateToken(): string {
	const arr = new Uint8Array(12);
	globalThis.crypto.getRandomValues(arr);
	return Array.from(arr, (v) => v.toString(16).padStart(2, "0")).join("");
}

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
	// Store the user in the database
	const token = generateToken();
	const cookieStore = await cookies();
	cookieStore.set("access_token", token);

	return { data: { user } };
}

export async function signInWithOAuth(_: SignInWithOAuthParams): Promise<{ error?: string }> {
	return { error: "Social authentication not implemented" };
}

export async function signInWithPassword(
	params: SignInWithPasswordParams
): Promise<{ data?: { user: User }; error?: string }> {
	const { email, password } = params;

	// We hardcode the credentials for the simplicity of the example
	if (email !== "sofia@devias.io" || password !== "Secret1") {
		return { error: "Invalid credentials" };
	}

	const token = generateToken();
	const cookieStore = await cookies();
	cookieStore.set("access_token", token);

	return { data: { user } };
}

export async function resetPassword(_: ResetPasswordParams): Promise<{ error?: string }> {
	return { error: "Password reset not implemented" };
}

export async function updatePassword(_: ResetPasswordParams): Promise<{ error?: string }> {
	return { error: "Update reset not implemented" };
}

export async function signOut(): Promise<{ error?: string }> {
	const cookieStore = await cookies();
	cookieStore.delete("access_token");

	return {};
}
