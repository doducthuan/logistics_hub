"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

import { InlineEditableGrid } from "@/components/core/inline-editable-grid";

import {
	CATEGORY_CHILD_COLUMNS,
	createEmptyCategoryChildRow,
} from "./category-child-grid-config";
import type { InlineEditableGridRow } from "@/components/core/inline-editable-grid";

const boldInputLabelFormControlSx = {
	"& .MuiInputLabel-root": { fontWeight: 600 },
} as const;

const requiredLabelFormControlSx = {
	...boldInputLabelFormControlSx,
	"& .MuiFormLabel-asterisk": { color: "error.main" },
	"& .MuiInputLabel-asterisk": { color: "error.main" },
} as const;

interface FormState {
	name: string;
	description: string;
}

function defaultForm(): FormState {
	return { name: "", description: "" };
}

export interface CategoryCreateModalProps {
	open: boolean;
	onClose: () => void;
	onCreated: () => Promise<void>;
}

export function CategoryCreateModal({ open, onClose, onCreated }: CategoryCreateModalProps): React.JSX.Element {
	const [form, setForm] = React.useState<FormState>(defaultForm);
	const [childRows, setChildRows] = React.useState<InlineEditableGridRow[]>(() => [createEmptyCategoryChildRow()]);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (!open) {
			setForm(defaultForm());
			setChildRows([createEmptyCategoryChildRow()]);
			setError(null);
			setLoading(false);
		}
	}, [open]);

	const isValid = form.name.trim().length > 0;

	const handleSubmit = React.useCallback(async () => {
		if (!isValid || loading) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const parentPayload: Record<string, unknown> = {
				name: form.name.trim(),
				parent_id: null,
			};
			if (form.description.trim()) {
				parentPayload.description = form.description.trim();
			}
			const res = await fetch("/api/categories", {
				method: "POST",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify(parentPayload),
			});
			const data = (await res.json().catch(() => ({}))) as { detail?: string; id?: string };
			if (!res.ok) {
				setError(typeof data.detail === "string" ? data.detail : "Tạo loại thất bại");
				return;
			}
			const parentId = data.id;
			if (!parentId) {
				setError("Phản hồi máy chủ không hợp lệ");
				return;
			}

			const toCreate = childRows.filter((r) => r.name.trim().length > 0);
			for (const row of toCreate) {
				const body: Record<string, unknown> = {
					name: row.name.trim(),
					parent_id: parentId,
				};
				if (row.description.trim()) {
					body.description = row.description.trim();
				}
				const cr = await fetch("/api/categories", {
					method: "POST",
					headers: { "Content-Type": "application/json", Accept: "application/json" },
					body: JSON.stringify(body),
				});
				if (!cr.ok) {
					const err = (await cr.json().catch(() => ({}))) as { detail?: string };
					setError(
						typeof err.detail === "string"
							? `Loại con "${row.name.trim()}": ${err.detail}`
							: `Không tạo được loại con "${row.name.trim()}"`
					);
					return;
				}
			}

			await onCreated();
			onClose();
		} catch {
			setError("Không thể kết nối máy chủ");
		} finally {
			setLoading(false);
		}
	}, [childRows, form.description, form.name, isValid, loading, onClose, onCreated]);

	return (
		<Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
			<DialogTitle
				component="div"
				sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", pr: 1.5 }}
			>
				<Typography component="span" sx={{ fontWeight: 600 }} variant="h6">
					Thêm loại mặt hàng
				</Typography>
				<IconButton onClick={onClose}>
					<XIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers>		
				{error ? (
					<Alert severity="error" sx={{ mb: 2 }}>
						{error}
					</Alert>
				) : null}
				<Stack spacing={3}>
					<Stack spacing={2}>
						<FormControl fullWidth required sx={requiredLabelFormControlSx}>
							<InputLabel>Tên</InputLabel>
							<OutlinedInput
								label="Tên"
								onChange={(e) => {
									setForm((p) => ({ ...p, name: e.target.value }));
								}}
								value={form.name}
							/>
						</FormControl>
						<FormControl fullWidth sx={boldInputLabelFormControlSx}>
							<InputLabel>Mô tả</InputLabel>
							<OutlinedInput
								label="Mô tả"
								minRows={2}
								multiline
								onChange={(e) => {
									setForm((p) => ({ ...p, description: e.target.value }));
								}}
								value={form.description}
							/>
						</FormControl>
					</Stack>
					<Stack spacing={1}>
						<Typography sx={{ fontWeight: 600 }} variant="subtitle2">
							Danh sách mặt hàng phụ thuộc
						</Typography>
						<Typography color="text.secondary" variant="caption">
							Tab chuyển ô; Tab hoặc Enter ở cột cuối thêm dòng. Dòng để trống tên sẽ bỏ qua khi lưu.
						</Typography>
						<TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
							<InlineEditableGrid
								addRowOnLastCellAdvance
								columns={CATEGORY_CHILD_COLUMNS}
								createEmptyRow={createEmptyCategoryChildRow}
								minRows={1}
								onRowsChange={setChildRows}
								rows={childRows}
							/>
						</TableContainer>
					</Stack>
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button color="secondary" onClick={onClose}>
					Hủy
				</Button>
				<Button disabled={!isValid || loading} onClick={() => void handleSubmit()} variant="contained">
					{loading ? "Đang lưu..." : "Tạo"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
