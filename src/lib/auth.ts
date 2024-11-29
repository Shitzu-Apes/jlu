import { writable } from 'svelte/store';

export type Auth = {
	expires_at: number;
	token: {
		access_token: string;
		expires_in: number;
		refresh_token: string;
		scope: string;
		token_type: 'bearer';
	};
	user: {
		id: string;
		name: string;
		username: string;
	};
};

export const session$ = writable<Auth | undefined>();
