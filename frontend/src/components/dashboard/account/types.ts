export type AccountRole = "admin" | "user_level_1" | "user_level_2";

export interface AccountItem {
	id: string;
	email: string;
	full_name: string;
	role: AccountRole;
	is_active: boolean;
	phone?: string | null;
	description?: string | null;
	parent_id?: string | null;
	created_by_id?: string | null;
	updated_by_id?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	last_login_at?: string | null;
}

export interface AccountsApiResponse {
	current: AccountItem;
	data: AccountItem[];
	count: number;
	page?: number;
	pageSize?: number;
}

export interface AccountCreatePayload {
	email: string;
	password: string;
	full_name: string;
	phone?: string | null;
	description?: string | null;
	parent_id?: string | null;
	role: AccountRole;
}
