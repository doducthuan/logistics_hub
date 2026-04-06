"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import OutlinedInput from "@mui/material/OutlinedInput";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";

/** Một dòng: `_rowKey` bắt buộc (ổn định cho React); các key trùng `columns`; `_serverId` tùy chọn (metadata, không hiển thị). */
export type InlineEditableGridRow = {
	_rowKey: string;
	_serverId?: string;
} & Record<string, string>;

export interface InlineEditableColumnDef {
	key: string;
	label: string;
	width?: string | number;
	multiline?: boolean;
	placeholder?: string;
	/**
	 * Ô một dòng: khi nhập, nội dung dài cuộn ngang.
	 * Khi `disabled` (chỉ xem), hiển thị text xuống dòng trong ô.
	 */
	scrollableSingleLine?: boolean;
}

export interface InlineEditableGridProps {
	columns: readonly InlineEditableColumnDef[];
	rows: InlineEditableGridRow[];
	onRowsChange: (next: InlineEditableGridRow[]) => void;
	/** Tạo dòng trống mới (phải có `_rowKey` và mọi `columns.key` = ""). */
	createEmptyRow: () => InlineEditableGridRow;
	disabled?: boolean;
	minRows?: number;
	maxRows?: number;
	/** Tab / Enter ở ô cuối cùng: thêm dòng (mặc định true). */
	addRowOnLastCellAdvance?: boolean;
}

function cellRefKey(row: number, col: number): string {
	return `${row}:${col}`;
}

/**
 * Bảng nhập liệu trực tiếp: STT, cột cấu hình, +/- mỗi dòng.
 * Tab chuyển ô; Shift+Tab lùi; Tab/Enter ở ô cuối thêm dòng mới và focus ô đầu dòng mới.
 */
export function InlineEditableGrid({
	columns,
	rows,
	onRowsChange,
	createEmptyRow,
	disabled = false,
	minRows = 1,
	maxRows,
	addRowOnLastCellAdvance = true,
}: InlineEditableGridProps): React.JSX.Element {
	const inputRefs = React.useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
	const pendingFocusRef = React.useRef<{ row: number; col: number } | null>(null);

	const numCols = columns.length;

	const setInputRef = React.useCallback((row: number, col: number, el: HTMLInputElement | null) => {
		const k = cellRefKey(row, col);
		if (el) {
			inputRefs.current.set(k, el);
		} else {
			inputRefs.current.delete(k);
		}
	}, []);

	const focusCell = React.useCallback((row: number, col: number) => {
		const el = inputRefs.current.get(cellRefKey(row, col));
		el?.focus();
	}, []);

	React.useLayoutEffect(() => {
		const p = pendingFocusRef.current;
		if (!p) {
			return;
		}
		pendingFocusRef.current = null;
		queueMicrotask(() => {
			focusCell(p.row, p.col);
		});
	}, [rows, focusCell]);

	const updateCell = React.useCallback(
		(rowIndex: number, key: string, value: string) => {
			const next = rows.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r));
			onRowsChange(next);
		},
		[onRowsChange, rows]
	);

	const addRowAfter = React.useCallback(
		(afterIndex: number) => {
			if (maxRows !== undefined && rows.length >= maxRows) {
				return;
			}
			const empty = createEmptyRow();
			const next = [...rows.slice(0, afterIndex + 1), empty, ...rows.slice(afterIndex + 1)];
			onRowsChange(next);
			pendingFocusRef.current = { row: afterIndex + 1, col: 0 };
		},
		[createEmptyRow, maxRows, onRowsChange, rows]
	);

	const removeRowAt = React.useCallback(
		(index: number) => {
			if (rows.length <= minRows) {
				return;
			}
			for (let c = 0; c < numCols; c++) {
				inputRefs.current.delete(cellRefKey(index, c));
			}
			const next = rows.filter((_, i) => i !== index);
			onRowsChange(next);
			queueMicrotask(() => {
				const targetRow = Math.min(index, next.length - 1);
				focusCell(Math.max(0, targetRow), 0);
			});
		},
		[focusCell, minRows, numCols, onRowsChange, rows]
	);

	const advanceFrom = React.useCallback(
		(rowIndex: number, colIndex: number, event: "tab" | "enter") => {
			const lastCol = numCols - 1;
			const lastRow = rows.length - 1;
			const isLastCell = rowIndex === lastRow && colIndex === lastCol;

			if (event === "enter" && columns[colIndex]?.multiline && !isLastCell) {
				return false;
			}

			if (isLastCell && addRowOnLastCellAdvance && !disabled) {
				if (maxRows !== undefined && rows.length >= maxRows) {
					return false;
				}
				const empty = createEmptyRow();
				onRowsChange([...rows, empty]);
				pendingFocusRef.current = { row: rows.length, col: 0 };
				return true;
			}

			if (colIndex < lastCol) {
				focusCell(rowIndex, colIndex + 1);
				return true;
			}
			if (rowIndex < lastRow) {
				focusCell(rowIndex + 1, 0);
				return true;
			}
			return false;
		},
		[addRowOnLastCellAdvance, columns, createEmptyRow, disabled, focusCell, maxRows, numCols, onRowsChange, rows]
	);

	const retreatFrom = React.useCallback(
		(rowIndex: number, colIndex: number) => {
			if (colIndex > 0) {
				focusCell(rowIndex, colIndex - 1);
				return true;
			}
			if (rowIndex > 0) {
				focusCell(rowIndex - 1, numCols - 1);
				return true;
			}
			return false;
		},
		[focusCell, numCols]
	);

	const handleKeyDown = React.useCallback(
		(rowIndex: number, colIndex: number, e: React.KeyboardEvent) => {
			if (disabled) {
				return;
			}
			if (e.key === "Tab") {
				e.preventDefault();
				if (e.shiftKey) {
					retreatFrom(rowIndex, colIndex);
				} else {
					advanceFrom(rowIndex, colIndex, "tab");
				}
				return;
			}
			if (e.key === "Enter") {
				const isLast = rowIndex === rows.length - 1 && colIndex === numCols - 1;
				const multiline = columns[colIndex]?.multiline;
				if (multiline && !isLast) {
					return;
				}
				e.preventDefault();
				advanceFrom(rowIndex, colIndex, "enter");
			}
		},
		[advanceFrom, columns, disabled, numCols, retreatFrom, rows.length]
	);

	return (
		<Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
			<TableHead>
				<TableRow>
					<TableCell
						align="center"
						sx={(theme) => ({
							fontSize: theme.typography.body2.fontSize,
							fontWeight: 600,
							lineHeight: theme.typography.body2.lineHeight,
							verticalAlign: "middle",
							width: 56,
						})}
					>
						STT
					</TableCell>
					{columns.map((col) => (
						<TableCell
							key={col.key}
							sx={(theme) => ({
								fontSize: theme.typography.body2.fontSize,
								fontWeight: 600,
								lineHeight: theme.typography.body2.lineHeight,
								verticalAlign: "middle",
								width: col.width,
							})}
						>
							{col.label}
						</TableCell>
					))}
					<TableCell
						align="right"
						sx={(theme) => ({
							fontSize: theme.typography.body2.fontSize,
							fontWeight: 600,
							lineHeight: theme.typography.body2.lineHeight,
							verticalAlign: "middle",
							width: 96,
						})}
					>
						Thao tác
					</TableCell>
				</TableRow>
			</TableHead>
			<TableBody>
				{rows.map((row, rowIndex) => (
					<TableRow key={row._rowKey}>
						<TableCell align="center" sx={{ verticalAlign: "middle" }}>
							<Typography align="center" variant="body2">
								{rowIndex + 1}
							</Typography>
						</TableCell>
						{columns.map((col, colIndex) => {
							const scrollLine = Boolean(col.scrollableSingleLine);
							const raw = row[col.key] ?? "";
							const showWrapped = disabled && scrollLine;

							return (
								<TableCell
									key={col.key}
									sx={{
										maxWidth: 0,
										minWidth: 0,
										py: 1,
										verticalAlign: scrollLine || !col.multiline ? "middle" : "top",
									}}
								>
									{showWrapped ? (
										<Typography
											color={raw ? "text.primary" : "text.secondary"}
											variant="body2"
											sx={{
												overflowWrap: "anywhere",
												whiteSpace: "normal",
												wordBreak: "break-word",
											}}
										>
											{raw.trim() ? raw : "—"}
										</Typography>
									) : (
										<OutlinedInput
											disabled={disabled}
											fullWidth
											inputRef={(el) => {
												setInputRef(rowIndex, colIndex, el);
											}}
											minRows={col.multiline && !scrollLine ? 2 : undefined}
											multiline={Boolean(col.multiline && !scrollLine)}
											onChange={(e) => {
												updateCell(rowIndex, col.key, e.target.value);
											}}
											onKeyDown={(e) => {
												handleKeyDown(rowIndex, colIndex, e);
											}}
											placeholder={col.placeholder}
											size="small"
											sx={{
												minWidth: 0,
												...(scrollLine
													? {
															"& .MuiOutlinedInput-input": {
																overflowX: "auto",
																textOverflow: "clip",
																whiteSpace: "nowrap",
															},
														}
													: {}),
											}}
											value={raw}
										/>
									)}
								</TableCell>
							);
						})}
						<TableCell align="right" sx={{ verticalAlign: "middle" }}>
							<Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
								<IconButton
									aria-label="Thêm dòng phía dưới"
									disabled={disabled || (maxRows !== undefined && rows.length >= maxRows)}
									onClick={() => {
										addRowAfter(rowIndex);
									}}
									size="small"
								>
									<PlusIcon />
								</IconButton>
								<IconButton
									aria-label="Xóa dòng"
									disabled={disabled || rows.length <= minRows}
									onClick={() => {
										removeRowAt(rowIndex);
									}}
									size="small"
								>
									<MinusIcon />
								</IconButton>
							</Box>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
