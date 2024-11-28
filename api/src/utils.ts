import type { Context } from 'hono';

export function redirectToFrontend(c: Context, status: string, message: string) {
	const redirectUrl = new URL(`${c.env.FRONTEND_URL}/meme/${c.req.query('state')}`);
	redirectUrl.searchParams.append('status', status);
	redirectUrl.searchParams.append('message', encodeURIComponent(message));
	return c.redirect(redirectUrl.toString());
}

export function twitterLinkToUsername(twitterLink: string) {
	const twitterUsername = twitterLink?.split('/').pop();
	// remove any query params
	return twitterUsername?.split('?')[0]?.toLowerCase();
}
