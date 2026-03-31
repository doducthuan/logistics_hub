import type { User } from "./types";

export const user = {
	id: "USR-000",
	avatar: "/assets/avatar.png",
	firstName: "Sofia",
	lastName: "Rivers",
	fullName: "Sofia Rivers",
	email: "sofia@devias.io",
	role: "admin",
} satisfies User;
