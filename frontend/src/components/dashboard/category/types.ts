export interface CategoryItem {
	id: string;
	name: string;
	description?: string | null;
	parent_id?: string | null;
	is_active: boolean;
	created_at?: string | null;
	updated_at?: string | null;
	created_by_id?: string | null;
	updated_by_id?: string | null;
	/** Họ tên từ API (join), không gọi GET /accounts/{id}. */
	created_by_full_name?: string | null;
	updated_by_full_name?: string | null;
}

export interface CategoriesApiResponse {
	data: CategoryItem[];
	count: number;
	page?: number;
	pageSize?: number;
}

export interface CategoryCreatePayload {
	name: string;
	description?: string | null;
	parent_id?: string | null;
}
