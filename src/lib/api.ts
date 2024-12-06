import { get } from 'svelte/store';

import { session$ } from './auth';

export async function fetchApi(
	path: string,
	options?: {
		method?: string;
		body?: unknown;
	}
) {
	const session = await get(session$);
	if (!session) {
		throw new Error('Not authenticated');
	}

	const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
		method: options?.method ?? 'GET',
		headers: {
			Authorization: `Bearer ${session.token.access_token}`,
			'X-User-Id': session.user.id,
			'Content-Type': 'application/json'
		},
		...(options?.body ? { body: JSON.stringify(options.body) } : {})
	});

	if (response.status === 401) {
		console.log('[api] Session expired, clearing auth');
		localStorage.removeItem('auth');
		session$.set(Promise.resolve(undefined));
		throw new Error('Session expired');
	}

	return response;
}