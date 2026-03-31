export type AccountRole = "admin" | "user_level_1" | "user_level_2";

export interface User {
	id: string;
	avatar: string;
	firstName: string;
	lastName: string;
	email: string;
	fullName: string;
	/** From backend `Account.role`; used for dashboard permissions. */
	role: AccountRole;
}
