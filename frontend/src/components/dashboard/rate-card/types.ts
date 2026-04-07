export interface RateCardRow {
	category_id: string;
	category_name: string;
	unit_rate: string;
	surcharge: string;
	effective_date: string | null;
}

export interface RateCardsByAccountResponse {
	account_id: string;
	effective_on: string;
	data: RateCardRow[];
	count: number;
}

export interface RateCardHistoryEntry {
	effective_date: string;
	unit_rate: string;
	surcharge: string;
	is_currently_effective: boolean;
}

export interface RateCardCategoryHistoryResponse {
	account_id: string;
	category_id: string;
	category_name: string;
	data: RateCardHistoryEntry[];
	count: number;
}
