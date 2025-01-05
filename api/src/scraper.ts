import { Scraper } from 'agent-twitter-client-cf-workers';
import { Cookie } from 'tough-cookie';

import type { EnvBindings } from '../types';

import type { EngageableTweet } from './definitions';
import { getAuthor } from './tweet';

export async function getScraper(env: EnvBindings) {
	const scraper = new Scraper();

	const cookiesString = await env.KV.get('twitter_cookies');
	let cookies = cookiesString
		? // eslint-disable-next-line @typescript-eslint/no-explicit-any
			JSON.parse(cookiesString).map((cookie: any) => Cookie.fromJSON(cookie))
		: [];
	if (env.TWITTER_COOKIE && cookies.length === 0) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		cookies = JSON.parse(env.TWITTER_COOKIE).map((cookie: any) => Cookie.fromJSON(cookie));
	}
	if (cookies.length === 0) {
		console.log('[login]');
		throw new Error("don't do this");
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
			expirationTtl: 60 * 60 * 24 * 365
		});
	} else {
		console.log('[login via cookies]');
		await scraper.setCookies(cookies);
	}

	return scraper;
}

export async function getTweet(scraper: Scraper, tweetId: string, env: EnvBindings) {
	const scrapedTweet = await scraper.getTweet(tweetId);
	if (
		!scrapedTweet ||
		!scrapedTweet.id ||
		!scrapedTweet.text ||
		!scrapedTweet.userId ||
		!scrapedTweet.username ||
		!scrapedTweet.timestamp ||
		scrapedTweet.likes == null ||
		scrapedTweet.replies == null ||
		scrapedTweet.retweets == null
	) {
		return null;
	}
	const tweet: EngageableTweet = {
		tweet: {
			id: scrapedTweet.id,
			text: scrapedTweet.text,
			author_id: scrapedTweet.userId,
			created_at: new Date(scrapedTweet.timestamp).toISOString(),
			public_metrics: {
				like_count: scrapedTweet.likes,
				reply_count: scrapedTweet.replies,
				retweet_count: scrapedTweet.retweets,
				quote_count: 0,
				impression_count: 0
			},
			author: await getAuthor(scrapedTweet.userId, scrapedTweet.username, scraper, env)
		},
		thread: scrapedTweet.thread.map((t) => ({
			id: t.id ?? '',
			text: t.text ?? '',
			author: t.username ?? ''
		})),
		inReplyToStatusId: scrapedTweet.inReplyToStatusId
	};
	await env.KV.put(`tweet:${tweet.tweet.id}`, JSON.stringify(tweet), {
		expirationTtl: 60 * 60 * 24 * 3
	});
	return tweet;
}
