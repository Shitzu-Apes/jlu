import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';

export const verifyMemeCookingSession = async (c: Context, next: Next) => {
	const token = getCookie(c, 'meme_cooking_session');

	if (!token) {
		return c.json({ message: 'Unauthorized' }, 401);
	}

	try {
		const secret = c.env.JWT_SECRET;
		const payload = await verify(token, secret);
		c.set('user', payload);
		await next();
	} catch (_err) {
		return c.json({ message: 'Unauthorized' }, 401);
	}
};
