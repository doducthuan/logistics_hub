import type { InlineEditableColumnDef, InlineEditableGridRow } from "@/components/core/inline-editable-grid";

export const CATEGORY_CHILD_COLUMNS: InlineEditableColumnDef[] = [
	{
		key: "name",
		label: "Tên",
		placeholder: "Tên loại con",
		scrollableSingleLine: true,
		width: "28%",
	},
	{
		key: "description",
		label: "Mô tả",
		placeholder: "Mô tả",
		scrollableSingleLine: true,
		width: "auto",
	},
];

export function createEmptyCategoryChildRow(): InlineEditableGridRow {
	return {
		_rowKey: crypto.randomUUID(),
		name: "",
		description: "",
	};
}

export function categoryItemToChildRow(item: { id: string; name: string; description?: string | null }): InlineEditableGridRow {
	return {
		_rowKey: crypto.randomUUID(),
		_serverId: item.id,
		name: item.name ?? "",
		description: item.description ?? "",
	};
}
