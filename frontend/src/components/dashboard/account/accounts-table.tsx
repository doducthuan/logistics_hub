"use client";

import * as React from "react";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { CopyIcon } from "@phosphor-icons/react/dist/ssr/Copy";
import { EyeIcon } from "@phosphor-icons/react/dist/ssr/Eye";

import { dayjs } from "@/lib/dayjs";
import type { ColumnDef } from "@/components/core/data-table";
import { DataTable } from "@/components/core/data-table";
import { toast } from "@/components/core/toaster";

import type { AccountItem } from "./types";

const activeLabelMap: Record<"active" | "inactive", { label: string; color: "success" | "default" }> = {
	active: { label: "Đang hoạt động", color: "success" },
	inactive: { label: "Tạm khóa", color: "default" },
};

export interface AccountsTableProps {
	rows: AccountItem[];
	loading?: boolean;
	onView: (account: AccountItem) => void;
}

export function AccountsTable({ rows, loading = false, onView }: AccountsTableProps): React.JSX.Element {
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
				width: "260px",
				formatter: (row) => (
					<div>
						<Typography sx={{ whiteSpace: "nowrap" }} variant="subtitle2">
							{row.full_name}
						</Typography>
						{row.phone ? (
							<Stack alignItems="center" direction="row" spacing={0.5}>
								<Typography color="text.secondary" variant="body2">
									{row.phone}
								</Typography>
								<Tooltip title="Copy số điện thoại">
									<IconButton
										aria-label="Copy số điện thoại"
										onClick={() => {
											void handleCopyPhone(row.phone!);
										}}
										size="small"
										sx={{ p: 0.25 }}
									>
										<CopyIcon size={14} />
									</IconButton>
								</Tooltip>
							</Stack>
						) : (
							<Typography color="text.secondary" variant="body2">
								Chưa có số điện thoại
							</Typography>
						)}
					</div>
				),
			},
			{ name: "Email", width: "220px", formatter: (row) => row.email },
			{
				name: "Mô tả",
				width: "260px",
				formatter: (row) => row.description || "—",
			},
			{
				name: "Trạng thái",
				align: "center",
				width: "120px",
				formatter: (row) => {
					const map = row.is_active ? activeLabelMap.active : activeLabelMap.inactive;
					return <Chip color={map.color} label={map.label} size="small" variant="outlined" />;
				},
			},
			{
				name: "Ngày tạo",
				align: "center",
				width: "180px",
				formatter: (row) =>
					row.created_at ? dayjs(row.created_at).format("DD/MM/YYYY") : "—",
			},
			{
				name: "Thao tác",
				hideName: true,
				align: "right",
				width: "80px",
				formatter: (row) => (
					<Stack direction="row" justifyContent="flex-end">
						<IconButton
							onClick={() => {
								onView(row);
							}}
						>
							<EyeIcon />
						</IconButton>
					</Stack>
				),
			},
		],
		[handleCopyPhone, onView]
	);

	return (
		<React.Fragment>
			<DataTable<AccountItem>
				columns={columns}
				headCellSx={(theme) => ({
					color:
						theme.palette.mode === "light" ? theme.palette.grey[900] : theme.palette.common.white,
					fontSize: "1rem",
					fontWeight: 700,
					letterSpacing: "0.02em",
				})}
				rows={rows}
			/>
			{rows.length === 0 ? (
				<Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }} variant="body2">
					{loading ? "Đang tải dữ liệu tài khoản..." : "Không có tài khoản con nào"}
				</Typography>
			) : null}
		</React.Fragment>
	);
}
