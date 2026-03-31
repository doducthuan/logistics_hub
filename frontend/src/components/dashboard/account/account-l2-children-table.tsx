"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TableContainer from "@mui/material/TableContainer";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { CopyIcon } from "@phosphor-icons/react/dist/ssr/Copy";
import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr/LockSimple";

import { dayjs } from "@/lib/dayjs";
import type { ColumnDef } from "@/components/core/data-table";
import { DataTable } from "@/components/core/data-table";
import { toast } from "@/components/core/toaster";

import type { AccountItem } from "./types";

const DESCRIPTION_PREVIEW_CHARS = 80;

function TruncatedDescription({
	compact,
	text,
}: {
	compact?: boolean;
	text: string | null | undefined;
}): React.JSX.Element {
	const raw = (text ?? "").trim();
	const bodyVariant = compact ? "caption" : "body2";
	if (!raw) {
		return (
			<Typography color="text.secondary" variant={bodyVariant}>
				—
			</Typography>
		);
	}
	const truncated = raw.length > DESCRIPTION_PREVIEW_CHARS ? `${raw.slice(0, DESCRIPTION_PREVIEW_CHARS)}…` : raw;
	const body = (
		<Typography sx={{ lineHeight: 1.45 }} variant={bodyVariant}>
			{truncated}
		</Typography>
	);
	if (raw.length <= DESCRIPTION_PREVIEW_CHARS) {
		return body;
	}
	return (
		<Tooltip
			enterDelay={300}
			title={
				<Typography
					component="span"
					sx={{ display: "block", maxWidth: 420, whiteSpace: "pre-wrap" }}
					variant={compact ? "caption" : "body2"}
				>
					{raw}
				</Typography>
			}
		>
			<Box component="span" sx={{ cursor: "help", display: "inline-block" }}>
				{body}
			</Box>
		</Tooltip>
	);
}

export interface AccountL2ChildrenTableProps {
	/** Chữ và bảng nhỏ gọn (modal User cấp 2). */
	compact?: boolean;
	rows: AccountItem[];
}

export function AccountL2ChildrenTable({ compact = false, rows }: AccountL2ChildrenTableProps): React.JSX.Element {
	const nameVariant = compact ? "body2" : "subtitle2";
	const secondaryVariant = compact ? "caption" : "body2";
	const headFontSize = compact ? "0.75rem" : "0.9375rem";
	const lockIconSize = compact ? 14 : 16;
	const copyIconSize = compact ? 12 : 14;
	const handleCopyPhone = React.useCallback(async (phone: string): Promise<void> => {
		try {
			await navigator.clipboard.writeText(phone);
			toast.success("Đã copy số điện thoại");
		} catch {
			toast.error("Không thể copy số điện thoại");
		}
	}, []);

	const columns = React.useMemo<ColumnDef<AccountItem>[]>(
		() => [
			{
				name: "Tài khoản",
				width: "240px",
				formatter: (row) => (
					<div>
						<Stack
							alignItems="center"
							direction="row"
							spacing={0.25}
							sx={{ minWidth: 0, width: "100%" }}
						>
							<Typography
								noWrap
								sx={{
									flex: "0 1 auto",
									maxWidth: row.is_active ? "100%" : `calc(100% - ${lockIconSize + 6}px)`,
									minWidth: 0,
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
								variant={nameVariant}
							>
								{row.full_name}
							</Typography>
							{!row.is_active ? (
								<Box
									aria-hidden
									component="span"
									sx={{ color: "error.main", display: "flex", flexShrink: 0, lineHeight: 0 }}
								>
									<LockSimpleIcon size={lockIconSize} weight="fill" />
								</Box>
							) : null}
						</Stack>
						{row.phone ? (
							<Stack alignItems="center" direction="row" spacing={0.5}>
								<Typography color="text.secondary" variant={secondaryVariant}>
									{row.phone}
								</Typography>
								<Tooltip title="Copy số điện thoại">
									<IconButton
										aria-label="Copy số điện thoại"
										onClick={() => {
											void handleCopyPhone(row.phone!);
										}}
										size="small"
										sx={{ p: compact ? 0.125 : 0.25 }}
									>
										<CopyIcon size={copyIconSize} />
									</IconButton>
								</Tooltip>
							</Stack>
						) : (
							<Typography color="text.secondary" variant={secondaryVariant}>
								Chưa có số điện thoại
							</Typography>
						)}
					</div>
				),
			},
			{
				name: "Email",
				width: "220px",
				formatter: (row) => (
					<div>
						<Typography sx={{ wordBreak: "break-all" }} variant={secondaryVariant}>
							{row.email}
						</Typography>
						<Typography color="text.secondary" variant={secondaryVariant}>
							{row.created_at ? `${dayjs(row.created_at).format("DD/MM/YYYY")}` : "—"}
						</Typography>
					</div>
				),
			},
			{
				name: "Mô tả",
				width: "260px",
				formatter: (row) => <TruncatedDescription compact={compact} text={row.description} />,
			},
		],
		[compact, copyIconSize, handleCopyPhone, lockIconSize, nameVariant, secondaryVariant],
	);

	const table = (
		<DataTable<AccountItem>
			columns={columns}
			headCellSx={(theme) => ({
				color: theme.palette.mode === "light" ? theme.palette.grey[900] : theme.palette.common.white,
				fontSize: headFontSize,
				fontWeight: 700,
				py: compact ? 0.75 : undefined,
			})}
			rows={rows}
			size={compact ? "small" : "medium"}
			sx={
				compact
					? {
						// 240 + 220 + 260 — giữ kích thước cột, cuộn ngang khi modal hẹp
						minWidth: 720,
						tableLayout: "fixed",
						width: "100%",
					}
					: undefined
			}
		/>
	);

	if (!compact) {
		return table;
	}

	return (
		<TableContainer
			sx={{
				maxWidth: "100%",
				minWidth: 0,
				overflowX: "auto",
				WebkitOverflowScrolling: "touch",
			}}
		>
			{table}
		</TableContainer>
	);
}
