import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { Hono, type Env } from 'hono';
import { cors } from 'hono/cors';
import { poweredBy } from 'hono/powered-by';
import type { HTTPResponseError } from 'hono/types';

import type { EnvBindings } from '../types';

import { auth } from './auth';
import { chat } from './chat';
import { knowledge, updateNearKnowledge } from './knowledge';
import { memory } from './memory';
import { getLucySession } from './session';
import { processReplies, scheduleTweet, handleTweetOperation, tweet } from './tweet';

// eslint-disable-next-line import/no-named-as-default-member
dayjs.extend(duration);
// eslint-disable-next-line import/no-named-as-default-member
dayjs.extend(relativeTime);
// eslint-disable-next-line import/no-named-as-default-member
dayjs.extend(timezone);
// eslint-disable-next-line import/no-named-as-default-member
dayjs.extend(utc);

const app = new Hono<Env>();

app.use('*', poweredBy());
app.use(
	'*',
	cors({
		origin: '*',
		credentials: true
	})
);

app.route('/auth', auth);
app.route('/chat', chat);
app.route('/tweet', tweet);
app.route('/knowledge', knowledge);
app.route('/memory', memory);

app.post('/refresh', async (c) => {
	console.log('Refreshing Lucy session');
	const lucySession = await getLucySession(c);
	if (lucySession instanceof Response) {
		console.log('Lucy session refresh failed', lucySession.status, await lucySession.text());
		return lucySession;
	}

	console.log('Lucy session refreshed successfully');
	return c.json({ success: true });
});

app.onError(async (err) => {
	if (typeof (err as HTTPResponseError)['getResponse'] !== 'undefined') {
		const httpErr = err as HTTPResponseError;
		const res = httpErr.getResponse();
		const text = await res.clone().text();
		console.log(`[HTTPError ${res.status}]: ${text}`);
		return res;
	}
	console.log('Unknown error:', (err as Error).message);
	return new Response(null, {
		status: 500
	});
});

app.notFound(() => {
	return new Response(null, { status: 404 });
});

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		return app.fetch(request, env, ctx);
	},
	async scheduled(controller: ScheduledController, env: EnvBindings, ctx: ExecutionContext) {
		switch (controller.cron) {
			case '0/30 * * * *':
				await app.fetch(
					new Request('https://api.juicylucy.com/refresh', {
						method: 'POST'
					}),
					env,
					ctx
				);
				break;
			case '* * * * *':
				ctx.waitUntil(processReplies(env, ctx));
				// ctx.waitUntil(Promise.all([scheduleTweet(env, ctx), processReplies(env, ctx)]));
				break;
			case '*/3 * * * *':
				ctx.waitUntil(handleTweetOperation('scrape', 'lucy', env, ctx));
				break;
			case '1/31 * * * *':
				ctx.waitUntil(handleTweetOperation('scrape', 'simps', env, ctx));
				break;
			case '5/35 * * * *':
				ctx.waitUntil(handleTweetOperation('scrape', 'ai_agents', env, ctx));
				break;
			case '10/40 * * * *':
				ctx.waitUntil(handleTweetOperation('scrape', 'keywords', env, ctx));
				break;
			// case '25 * * * *':
			// 	ctx.waitUntil(handleTweetOperation('scrape', 'events', env, ctx));
			// 	break;
			case '15/45 * * * *':
				ctx.waitUntil(updateNearKnowledge(env, ctx));
				break;
			case '20/50 * * * *':
				ctx.waitUntil(handleTweetOperation('scrape', 'grok0', env, ctx));
				break;
			case '25/55 * * * *':
				ctx.waitUntil(handleTweetOperation('scrape', 'grok1', env, ctx));
				break;
			case '40 * * * *':
				ctx.waitUntil(handleTweetOperation('search', 'near', env, ctx));
				break;
		}
	}
};

export { FlirtBattle } from './chat';
export { Session } from './session';
export { Tweets } from './do/tweets';
export { TweetSearch } from './do/tweetSearch';
export { Knowledge } from './do/knowledge';
