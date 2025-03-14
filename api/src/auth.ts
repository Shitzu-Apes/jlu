import { Hono, type Context, type Env } from 'hono';

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

export type AuthResponse = Omit<Auth, 'expires_at'>;

export const auth = new Hono<Env>();

auth.get('/nonce', async (c) => {
	const array = new Uint32Array(56);
	crypto.getRandomValues(array);
	const nonce = Array.from(array, (dec) => ('0' + dec.toString(16)).substr(-2)).join('');
	return c.text(nonce);
});

auth.get('/authorize', async (c) => {
	const kv = c.env.KV;

	const nonce = c.req.query('nonce');
	if (!nonce) {
		return c.text('nonce not provided', { status: 400 });
	}
	const redirectUrl = c.req.query('redirect_url');
	if (!redirectUrl) {
		return c.text('redirectUrl not provided', { status: 400 });
	}

	// Generate code verifier
	const array = new Uint32Array(56);
	crypto.getRandomValues(array);
	const codeVerifier = Array.from(array, (dec) => ('0' + dec.toString(16)).substr(-2)).join('');

	// Generate code challenge
	const encoder = new TextEncoder();
	const data = encoder.encode(codeVerifier);
	const digest = await crypto.subtle.digest('SHA-256', data);
	const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

	await kv.put(`code_verifier:${nonce}`, codeVerifier);

	// Build authorization URL
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: c.env.TWITTER_CLIENT_ID,
		redirect_uri: redirectUrl,
		scope: 'tweet.read tweet.write users.read offline.access',
		state: nonce,
		code_challenge: codeChallenge,
		code_challenge_method: 'S256'
	});

	// Redirect to Twitter auth page
	return c.redirect(`https://x.com/i/oauth2/authorize?${params}`);
});

auth.get('/login/refresh', async (c) => {
	const refresh_token = c.req.query('refresh_token');
	if (!refresh_token) {
		return c.text('No refresh_token provided', { status: 400 });
	}
	const user_id = c.req.query('user_id');
	if (!user_id) {
		return c.text('No user_id provided', { status: 400 });
	}

	// Verify session and refresh token match
	const id = c.env.SESSION.idFromName(user_id);
	const session = c.env.SESSION.get(id);
	const res = await session.fetch(new URL(c.req.url).origin);
	if (!res.ok) {
		return c.text('Invalid session', { status: 400 });
	}
	const auth = await res.json<Auth>();

	if (auth.token.refresh_token !== refresh_token) {
		return c.text('refresh_token does not match', { status: 400 });
	}

	try {
		const basicAuth = btoa(`${c.env.TWITTER_CLIENT_ID}:${c.env.TWITTER_CLIENT_SECRET}`);

		console.log('[refresh] Attempting token refresh for user:', user_id);
		const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
			method: 'POST',
			headers: {
				Authorization: `Basic ${basicAuth}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				client_id: c.env.TWITTER_CLIENT_ID,
				grant_type: 'refresh_token',
				refresh_token
			})
		});

		const userId = c.req.header('X-User-Id');
		if (!userId) {
			return c.text('No user ID provided', { status: 400 });
		}
		const res = await handleTokenResponse(userId, c, tokenResponse);
		if (res instanceof Response) {
			return res;
		}

		const { token, user, expires_at } = res;
		return c.json({ token, user, expires_at });
	} catch (err) {
		console.error('[refresh] OAuth error:', err);
		return c.text('Authentication failed', { status: 400 });
	}
});

auth.get('/login', async (c) => {
	const kv = c.env.KV;

	const code = c.req.query('code');
	if (!code) {
		return c.text('No code provided', { status: 400 });
	}

	const nonce = c.req.query('nonce');
	if (!nonce) {
		return c.text('nonce not provided', { status: 400 });
	}
	const codeVerifier = await kv.get(`code_verifier:${nonce}`);

	if (!codeVerifier) {
		return c.text('No code verifier found', { status: 400 });
	}

	const redirectUrl = c.req.query('redirect_url');
	if (!redirectUrl) {
		return c.text('redirectUrl not provided', { status: 400 });
	}

	try {
		const basicAuth = btoa(`${c.env.TWITTER_CLIENT_ID}:${c.env.TWITTER_CLIENT_SECRET}`);

		console.log('[login] Attempting code exchange');
		const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
			method: 'POST',
			headers: {
				Authorization: `Basic ${basicAuth}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				client_id: c.env.TWITTER_CLIENT_ID,
				grant_type: 'authorization_code',
				code,
				redirect_uri: redirectUrl,
				code_verifier: codeVerifier
			})
		});

		const res = await handleTokenResponse(null, c, tokenResponse);

		if (res instanceof Response) {
			return res;
		}
		const { token, user, expires_at } = res;
		console.log('[login] Successfully logged in user:', user.id);
		return c.json({
			token,
			user,
			expires_at
		});
	} catch (err) {
		console.error('[login] OAuth error:', err);
		return c.text('Authentication failed', { status: 400 });
	}
});

auth.post('/logout', async (c) => {
	const userId = c.req.header('X-User-Id');
	if (!userId) {
		return c.text('No user ID provided', { status: 400 });
	}

	try {
		// Clear the user's session
		const id = c.env.SESSION.idFromName(userId);
		const session = c.env.SESSION.get(id);
		await session.fetch(new URL(c.req.url).origin, {
			method: 'DELETE'
		});

		return c.text('', 204);
	} catch (error) {
		console.error('[logout] Error clearing session:', error);
		return c.text('Failed to logout', 500);
	}
});

async function handleTwitterResponse(
	response: Response,
	context: string
): Promise<Response | undefined> {
	if (!response.ok) {
		const errorData = await response.text();
		if (response.status === 429) {
			const resetTime = response.headers.get('x-rate-limit-reset');
			const limit = response.headers.get('x-rate-limit-limit');
			const remaining = response.headers.get('x-rate-limit-remaining');
			console.error(`[${context}] Twitter rate limit exceeded:`, {
				resetTime: resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : 'unknown',
				limit,
				remaining,
				endpoint: response.url
			});
		} else {
			console.error(`[${context}] Request failed:`, {
				status: response.status,
				statusText: response.statusText,
				error: errorData
			});
		}
		return new Response('Twitter API request failed', { status: 400 });
	}
}

export async function handleTokenResponse(
	userId: string | null,
	c: Context<Env>,
	tokenResponse: Response
) {
	const tokenError = await handleTwitterResponse(tokenResponse, 'token');
	if (tokenError) return tokenError;

	const token: {
		access_token: string;
		expires_in: number;
		refresh_token: string;
		scope: string;
		token_type: 'bearer';
	} = await tokenResponse.json();
	console.log('[token] Token obtained successfully');

	let user: { id: string; name: string; username: string };

	// Try to get user data from KV cache first
	const kv = c.env.KV;
	const cacheKey = userId ? `user:${userId}` : null;
	const cachedUser = cacheKey
		? await kv.get<{
				id: string;
				name: string;
				username: string;
				cached_at: number;
			}>(cacheKey, 'json')
		: null;

	// Cache miss or data older than 24 hours
	if (!cachedUser || Date.now() - cachedUser.cached_at > 24 * 60 * 60 * 1000) {
		console.log('[user] Cache miss, fetching from Twitter');
		// Get user data from Twitter
		const userResponse = await fetch('https://api.x.com/2/users/me', {
			headers: {
				Authorization: `Bearer ${token.access_token}`
			}
		});

		const userError = await handleTwitterResponse(userResponse, 'user');
		if (userError) return userError;

		user = await userResponse
			.json<{
				data: {
					id: string;
					name: string;
					username: string;
				};
			}>()
			.then(({ data }) => data);

		// Cache the user data with timestamp
		await kv.put(
			`user:${user.id}`,
			JSON.stringify({
				...user,
				cached_at: Date.now()
			}),
			{
				expirationTtl: 24 * 60 * 60 // 24 hours in seconds
			}
		);
		console.log('[user] User data fetched and cached:', user.id);
	} else {
		// Use cached data
		const { id, name, username } = cachedUser;
		user = { id, name, username };
		console.log('[user] Using cached user data:', user.id);
	}

	const id = c.env.SESSION.idFromName(user.id);
	const session = c.env.SESSION.get(id);
	const expires_at = Date.now() + token.expires_in * 1_000;
	await session.fetch(new URL(c.req.url).origin, {
		method: 'PUT',
		body: JSON.stringify({
			token,
			user,
			expires_at
		} satisfies Auth)
	});

	return {
		token,
		user,
		expires_at
	};
}
