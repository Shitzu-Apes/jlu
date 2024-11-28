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
		scope: 'tweet.read users.read offline.access',
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

	const id = c.env.SESSION.idFromName(user_id);
	const session = c.env.SESSION.get(id);
	const res = await session.fetch(new URL(c.req.url).origin);
	if (!res.ok) {
		return c.text('', { status: 400 });
	}
	const auth = await res.json<Auth>();

	if (auth.token.refresh_token !== refresh_token) {
		return c.text('refresh_token does not match', { status: 400 });
	}

	try {
		const basicAuth = btoa(`${c.env.TWITTER_CLIENT_ID}:${c.env.TWITTER_CLIENT_SECRET}`);

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

		const res = await handleTokenResponse(c, tokenResponse);

		if (res instanceof Response) {
			return res;
		}
		const { token, user } = res;
		return c.json({
			token,
			user
		});
	} catch (err) {
		console.error('OAuth error:', err);
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

		const res = await handleTokenResponse(c, tokenResponse);

		if (res instanceof Response) {
			return res;
		}
		const { token, user } = res;
		return c.json({
			token,
			user
		});
	} catch (err) {
		console.error('OAuth error:', err);
		return c.text('Authentication failed', { status: 400 });
	}
});

async function handleTokenResponse(c: Context<Env>, tokenResponse: Response) {
	if (!tokenResponse.ok) {
		const errorData = await tokenResponse.text();
		console.error('Token exchange failed:', {
			status: tokenResponse.status,
			statusText: tokenResponse.statusText,
			error: errorData
		});
		return c.text('Failed to exchange code for token', { status: 400 });
	}

	const token: {
		access_token: string;
		expires_in: number;
		refresh_token: string;
		scope: string;
		token_type: 'bearer';
	} = await tokenResponse.json();
	console.log('[token]', token);

	// Get user data
	const userResponse = await fetch('https://api.x.com/2/users/me', {
		headers: {
			Authorization: `Bearer ${token.access_token}`
		}
	});

	if (!userResponse.ok) {
		const errorData = await userResponse.text();
		console.error('User data fetch failed:', {
			status: userResponse.status,
			statusText: userResponse.statusText,
			error: errorData
		});
		return c.text('Failed to get user data', { status: 400 });
	}

	const user = await userResponse
		.json<{
			data: {
				id: string;
				name: string;
				username: string;
			};
		}>()
		.then(({ data }) => data);

	const id = c.env.SESSION.idFromName(user.id);
	const session = c.env.SESSION.get(id);
	await session.fetch(new URL(c.req.url).origin, {
		method: 'PUT',
		body: JSON.stringify({
			expires_at: Date.now() + token.expires_in * 60 * 1_000,
			token,
			user
		} satisfies Auth)
	});

	return {
		token,
		user
	};
}
