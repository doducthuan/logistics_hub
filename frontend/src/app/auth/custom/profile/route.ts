import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearAccessTokenOnNextResponse } from "@/lib/custom-auth/access-token-cookie";
import { fetchAccountMe, mapAccountToUser } from "@/lib/custom-auth/api";

export async function GET(): Promise<NextResponse> {
	const cookieStore = await cookies();
	const token = cookieStore.get("access_token")?.value;

	if (!token) {
		return NextResponse.json({ user: null });
	}

	try {
		const me = await fetchAccountMe(token);
		if (me.ok) {
			return NextResponse.json({ user: mapAccountToUser(me.account) });
		}
		/* 404: tài khoản không tồn tại; 401: token không còn được API chấp nhận — xóa cookie giống đăng xuất. */
		if (me.status === 404 || me.status === 401) {
			const res = NextResponse.json({ user: null }, { status: 401 });
			return clearAccessTokenOnNextResponse(res);
		}
		return new NextResponse("Upstream unavailable", { status: 503 });
	} catch {
		return new NextResponse("Failed to validate session", { status: 500 });
	}
}
