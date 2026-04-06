import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/custom-auth/api";

interface RouteParams {
	params: Promise<{ categoryId: string }>;
}

async function getAccessToken(): Promise<string | null> {
	const cookieStore = await cookies();
	return cookieStore.get("access_token")?.value ?? null;
}

export async function GET(_: Request, context: RouteParams): Promise<NextResponse> {
	const accessToken = await getAccessToken();
	if (!accessToken) {
		return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
	}

	const { categoryId } = await context.params;

	const response = await fetch(`${getApiBaseUrl()}/api/v1/categories/${encodeURIComponent(categoryId)}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
		},
		cache: "no-store",
	});

	const data = (await response.json().catch(() => ({}))) as unknown;
	return NextResponse.json(data, { status: response.status });
}

export async function PATCH(request: Request, context: RouteParams): Promise<NextResponse> {
	const accessToken = await getAccessToken();
	if (!accessToken) {
		return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
	}

	const { categoryId } = await context.params;
	const body = (await request.json()) as unknown;

	const response = await fetch(`${getApiBaseUrl()}/api/v1/categories/${encodeURIComponent(categoryId)}`, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(body),
		cache: "no-store",
	});

	const data = (await response.json().catch(() => ({}))) as unknown;
	return NextResponse.json(data, { status: response.status });
}

export async function DELETE(_: Request, context: RouteParams): Promise<NextResponse> {
	const accessToken = await getAccessToken();
	if (!accessToken) {
		return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
	}

	const { categoryId } = await context.params;

	const response = await fetch(`${getApiBaseUrl()}/api/v1/categories/${encodeURIComponent(categoryId)}`, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
		},
		cache: "no-store",
	});

	const data = (await response.json().catch(() => ({}))) as unknown;
	return NextResponse.json(data, { status: response.status });
}
