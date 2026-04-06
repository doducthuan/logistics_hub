"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

import { InlineEditableGrid } from "@/components/core/inline-editable-grid";
import type { InlineEditableGridRow } from "@/components/core/inline-editable-grid";
import { Option } from "@/components/core/option";
import { dayjs } from "@/lib/dayjs";

import {
	CATEGORY_CHILD_COLUMNS,
	categoryItemToChildRow,
	createEmptyCategoryChildRow,
} from "./category-child-grid-config";
import type { CategoryItem } from "./types";

const boldInputLabelFormControlSx = {
	"& .MuiInputLabel-root": { fontWeight: 600 },
} as const;

const requiredLabelFormControlSx = {
	...boldInputLabelFormControlSx,
	"& .MuiFormLabel-asterisk": { color: "error.main" },
	"& .MuiInputLabel-asterisk": { color: "error.main" },
} as const;

export interface CategoryDetailsModalProps {
	open: boolean;
	category: CategoryItem | null;
	isAdmin: boolean;
	onClose: () => void;
	onUpdated: () => Promise<void>;
}

interface EditState {
	name: string;
	description: string;
	is_active: boolean;
}

function buildState(c: CategoryItem): EditState {
	return {
		name: c.name ?? "",
		description: c.description ?? "",
		is_active: c.is_active,
	};
}

export function CategoryDetailsModal({
	open,
	category,
	isAdmin,
	onClose,
	onUpdated,
}: CategoryDetailsModalProps): React.JSX.Element {
	const [form, setForm] = React.useState<EditState | null>(null);
	const [childRows, setChildRows] = React.useState<InlineEditableGridRow[]>([]);
	const [childrenLoading, setChildrenLoading] = React.useState(false);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [creatorName, setCreatorName] = React.useState("");
	const [updaterName, setUpdaterName] = React.useState("");

	const initialChildIdsRef = React.useRef<Set<string>>(new Set());

	React.useEffect(() => {
		if (category) {
			setForm(buildState(category));
			setError(null);
			setLoading(false);
		}
	}, [category]);

	React.useEffect(() => {
		if (!open || !category) {
			return;
		}
		let cancelled = false;
		(async () => {
			setChildrenLoading(true);
			try {
				const params = new URLSearchParams({
					parentId: category.id,
					page: "0",
					pageSize: "500",
				});
				const res = await fetch(`/api/categories?${params.toString()}`, { cache: "no-store" });
				const payload = (await res.json().catch(() => ({}))) as { data?: CategoryItem[] };
				if (cancelled) {
					return;
				}
				const list = Array.isArray(payload.data) ? payload.data : [];
				initialChildIdsRef.current = new Set(list.map((c) => c.id));
				if (list.length === 0) {
					setChildRows(isAdmin ? [createEmptyCategoryChildRow()] : []);
				} else {
					setChildRows(list.map(categoryItemToChildRow));
				}
			} catch {
				if (!cancelled) {
					setChildRows(isAdmin ? [createEmptyCategoryChildRow()] : []);
					initialChildIdsRef.current = new Set();
				}
			} finally {
				if (!cancelled) {
					setChildrenLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [category, category?.id, isAdmin, open]);

	React.useEffect(() => {
		let active = true;
		async function resolveNames(): Promise<void> {
			const createdId = category?.created_by_id ?? null;
			const updatedId = category?.updated_by_id ?? null;
			const ids = [...new Set([createdId, updatedId].filter(Boolean) as string[])];
			const nameById = new Map<string, string>();

			for (const id of ids) {
				const res = await fetch(`/api/accounts/${encodeURIComponent(id)}`, { cache: "no-store" });
				if (!res.ok) {
					nameById.set(id, "");
					continue;
				}
				const payload = (await res.json()) as { full_name?: string };
				nameById.set(id, payload.full_name ?? "");
			}

			if (!active) {
				return;
			}
			setCreatorName(createdId ? (nameById.get(createdId) ?? "") : "");
			setUpdaterName(updatedId ? (nameById.get(updatedId) ?? "") : "");
		}

		if (category && open) {
			void resolveNames();
		}

		return () => {
			active = false;
		};
	}, [category, category?.created_by_id, category?.updated_by_id, open]);

	const isValid = React.useMemo(() => {
		if (!form) {
			return false;
		}
		if (!form.name.trim()) {
			return false;
		}
		if (isAdmin) {
			for (const row of childRows) {
				if (row._serverId && !row.name.trim()) {
					return false;
				}
			}
		}
		return true;
	}, [childRows, form, isAdmin]);

	const handleSave = React.useCallback(async () => {
		if (!category || !form || loading || !isAdmin) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/categories/${encodeURIComponent(category.id)}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify({
					name: form.name.trim(),
					description: form.description.trim() || null,
					is_active: form.is_active,
				}),
			});
			const payload = (await res.json().catch(() => ({}))) as { detail?: string };
			if (!res.ok) {
				setError(payload.detail ?? "Cập nhật thất bại");
				return;
			}

			const currentIds = new Set(
				childRows.map((r) => r._serverId).filter((id): id is string => Boolean(id))
			);

			for (const id of initialChildIdsRef.current) {
				if (!currentIds.has(id)) {
					const dr = await fetch(`/api/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
					if (!dr.ok) {
						const err = (await dr.json().catch(() => ({}))) as { detail?: string };
						setError(typeof err.detail === "string" ? err.detail : "Không xóa được loại con");
						return;
					}
				}
			}

			for (const row of childRows) {
				const name = row.name.trim();
				const desc = row.description.trim() || null;
				if (row._serverId) {
					const pr = await fetch(`/api/categories/${encodeURIComponent(row._serverId)}`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json", Accept: "application/json" },
						body: JSON.stringify({ name, description: desc }),
					});
					if (!pr.ok) {
						const err = (await pr.json().catch(() => ({}))) as { detail?: string };
						setError(typeof err.detail === "string" ? err.detail : "Cập nhật loại con thất bại");
						return;
					}
				} else if (name) {
					const body: Record<string, unknown> = {
						name,
						parent_id: category.id,
					};
					if (desc) {
						body.description = desc;
					}
					const pr = await fetch("/api/categories", {
						method: "POST",
						headers: { "Content-Type": "application/json", Accept: "application/json" },
						body: JSON.stringify(body),
					});
					if (!pr.ok) {
						const err = (await pr.json().catch(() => ({}))) as { detail?: string };
						setError(
							typeof err.detail === "string"
								? `Loại con "${name}": ${err.detail}`
								: `Không tạo được loại con "${name}"`
						);
						return;
					}
				}
			}

			await onUpdated();
			onClose();
		} catch {
			setError("Không thể kết nối máy chủ");
		} finally {
			setLoading(false);
		}
	}, [category, childRows, form, isAdmin, loading, onClose, onUpdated]);

	const childGridMinRows = isAdmin ? 1 : Math.max(childRows.length, 0);

	return (
		<Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
			<DialogTitle
				component="div"
				sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", pr: 1.5 }}
			>
				<Typography component="span" sx={{ fontWeight: 600 }} variant="h6">
					Chi tiết loại mặt hàng
				</Typography>
				<IconButton onClick={onClose}>
					<XIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers>
				{error ? <Alert severity="error">{error}</Alert> : null}
				{form ? (
					<Stack spacing={3} sx={{ mt: error ? 2 : 0 }}>
						<Stack spacing={2}>
							<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
								<FormControl
									fullWidth
									required={isAdmin}
									sx={{ ...requiredLabelFormControlSx, flex: 1, minWidth: 0 }}
								>
									<InputLabel>Tên</InputLabel>
									<OutlinedInput
										disabled={!isAdmin}
										label="Tên"
										onChange={(e) => {
											setForm((p) => (p ? { ...p, name: e.target.value } : p));
										}}
										value={form.name}
									/>
								</FormControl>
								<FormControl
									fullWidth
									sx={{ ...boldInputLabelFormControlSx, flexShrink: 0, width: { xs: "100%", sm: 220 } }}
								>
									<InputLabel>Trạng thái</InputLabel>
									<Select
										disabled={!isAdmin}
										label="Trạng thái"
										onChange={(e) => {
											setForm((p) =>
												p ? { ...p, is_active: e.target.value === "active" } : p
											);
										}}
										value={form.is_active ? "active" : "inactive"}
									>
										<Option value="active">Đang hoạt động</Option>
										<Option value="inactive">Tạm khóa</Option>
									</Select>
								</FormControl>
							</Stack>
							<FormControl fullWidth sx={boldInputLabelFormControlSx}>
								<InputLabel>Mô tả</InputLabel>
								<OutlinedInput
									disabled={!isAdmin}
									label="Mô tả"
									minRows={2}
									multiline
									onChange={(e) => {
										setForm((p) => (p ? { ...p, description: e.target.value } : p));
									}}
									value={form.description}
								/>
							</FormControl>
						</Stack>

						<Stack spacing={1}>
							<Typography sx={{ fontWeight: 600 }} variant="subtitle2">
								Danh sách mặt hàng phụ thuộc
							</Typography>
							{childrenLoading ? (
								<Typography color="text.secondary" variant="body2">
									Đang tải danh sách loại con...
								</Typography>
							) : !isAdmin && childRows.length === 0 ? (
								<Typography color="text.secondary" variant="body2">
									Không có loại con.
								</Typography>
							) : (
								<>
									{isAdmin ? (
										<Typography color="text.secondary" variant="caption">
											Tab / Enter ở ô cuối thêm dòng; dòng mới không tên sẽ bỏ qua khi lưu. Xóa dòng có
											sẵn sẽ xóa trên máy chủ khi lưu.
										</Typography>
									) : null}
									<TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
										<InlineEditableGrid
											addRowOnLastCellAdvance={isAdmin}
											columns={CATEGORY_CHILD_COLUMNS}
											createEmptyRow={createEmptyCategoryChildRow}
											disabled={!isAdmin}
											minRows={childGridMinRows}
											onRowsChange={setChildRows}
											rows={childRows}
										/>
									</TableContainer>
								</>
							)}
						</Stack>

						<Stack spacing={2} sx={{ maxWidth: "100%", minWidth: 0 }}>
							<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
								<FormControl fullWidth sx={boldInputLabelFormControlSx}>
									<InputLabel shrink>Ngày tạo</InputLabel>
									<OutlinedInput
										inputProps={{ readOnly: true, tabIndex: -1 }}
										label="Ngày tạo"
										notched
										readOnly
										sx={{ "& .MuiInputBase-input": { cursor: "default" } }}
										value={
											category?.created_at
												? dayjs(category.created_at).format("HH:mm DD/MM/YYYY")
												: ""
										}
									/>
								</FormControl>
								<FormControl fullWidth sx={boldInputLabelFormControlSx}>
									<InputLabel shrink>Người tạo</InputLabel>
									<OutlinedInput
										inputProps={{ readOnly: true, tabIndex: -1 }}
										label="Người tạo"
										notched
										readOnly
										sx={{ "& .MuiInputBase-input": { cursor: "default" } }}
										value={creatorName || "Không rõ"}
									/>
								</FormControl>
							</Stack>
							<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
								<FormControl fullWidth sx={boldInputLabelFormControlSx}>
									<InputLabel shrink>Ngày cập nhật</InputLabel>
									<OutlinedInput
										inputProps={{ readOnly: true, tabIndex: -1 }}
										label="Ngày cập nhật"
										notched
										readOnly
										sx={{ "& .MuiInputBase-input": { cursor: "default" } }}
										value={
											category?.updated_at
												? dayjs(category.updated_at).format("HH:mm DD/MM/YYYY")
												: ""
										}
									/>
								</FormControl>
								<FormControl fullWidth sx={boldInputLabelFormControlSx}>
									<InputLabel shrink>Người cập nhật</InputLabel>
									<OutlinedInput
										inputProps={{ readOnly: true, tabIndex: -1 }}
										label="Người cập nhật"
										notched
										readOnly
										sx={{ "& .MuiInputBase-input": { cursor: "default" } }}
										value={updaterName || "Không rõ"}
									/>
								</FormControl>
							</Stack>
						</Stack>
					</Stack>
				) : (
					<Box sx={{ py: 2 }}>
						<Typography color="text.secondary" variant="body2">
							Không có dữ liệu.
						</Typography>
					</Box>
				)}
			</DialogContent>
			<DialogActions>
				<Button color="secondary" onClick={onClose}>
					Đóng
				</Button>
				{isAdmin ? (
					<Button
						disabled={!category || !form || !isValid || loading || childrenLoading}
						onClick={() => void handleSave()}
						variant="contained"
					>
						{loading ? "Đang lưu..." : "Cập nhật"}
					</Button>
				) : null}
			</DialogActions>
		</Dialog>
	);
}
