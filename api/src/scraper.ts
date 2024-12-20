import { Scraper } from 'agent-twitter-client-cf-workers';
import { Cookie } from 'tough-cookie';

import type { EnvBindings } from '../types';

export async function getScraper(env: EnvBindings) {
	const scraper = new Scraper();

	const cookiesString = await env.KV.get('twitter_cookies');
	let cookies = cookiesString
		? // eslint-disable-next-line @typescript-eslint/no-explicit-any
			JSON.parse(cookiesString).map((cookie: any) => Cookie.fromJSON(cookie))
		: [];
	if (cookies.length === 0) {
		console.log('[login]');
		await scraper.login(
			env.TWITTER_USERNAME,
			env.TWITTER_PASSWORD,
			env.TWITTER_EMAIL,
			env.TWITTER_2FA_SECRET,
			env.TWITTER_CLIENT_ID,
			env.TWITTER_CLIENT_SECRET,
			env.TWITTER_ACCESS_TOKEN,
			env.TWITTER_ACCESS_SECRET
		);
		cookies = await scraper.getCookies();
		console.log('[store cookies]', cookies);
		await env.KV.put('twitter_cookies', JSON.stringify(cookies), {
			expirationTtl: 60 * 60 * 24 * 14
		});
	} else {
		console.log('[login via cookies]');
		await scraper.setCookies(cookies);
	}

	return scraper;
}
