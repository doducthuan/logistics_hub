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
