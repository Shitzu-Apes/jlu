import type { Context, MiddlewareHandler } from 'hono';

import type { Auth } from '../auth';

export const requireAuth: MiddlewareHandler = async (c: Context, next) => {
	const authHeader = c.req.header('Authorization');
	const userId = c.req.header('X-User-Id');

	if (!authHeader) {
		return c.text('Missing authorization header', 401);
	}

	if (!userId) {
		return c.text('Missing user ID', 401);
	}

	const accessToken = authHeader.replace('Bearer ', '');
	if (!accessToken) {
		return c.text('Invalid authorization header', 401);
	}

	// Get session using user ID
	const sessionDO = c.env.SESSION.get(c.env.SESSION.idFromName(userId));
	const response = await sessionDO.fetch(new URL(c.req.url).origin);

	if (!response.ok) {
		return c.text('Invalid session', 401);
	}

	const auth = (await response.json()) as Auth;

	// Check if token matches
	if (auth.token.access_token !== accessToken) {
		return c.text('Invalid token', 401);
	}

	// Check if token is expired
	if (Date.now() >= auth.expires_at) {
		return c.text('Session expired', 401);
	}

	// Check if token expiration is invalid (X session expiration is 2 hours)
	if (auth.expires_at > Date.now() + 1_000 * 60 * 60 * 2) {
		return c.text('Session expired', 401);
	}

	// Check if user ID matches
	if (auth.user.id !== userId) {
		return c.text('Invalid user ID', 401);
	}

	c.set('session', auth);
	await next();
};
