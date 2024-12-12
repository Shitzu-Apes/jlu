import { Hono, type Env } from 'hono';
import { cors } from 'hono/cors';
import { poweredBy } from 'hono/powered-by';
import type { HTTPResponseError } from 'hono/types';

import { auth } from './auth';
import { chat } from './chat';
import { getLucySession } from './session';

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
	async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		await app.fetch(
			new Request('https://api.juicyl.com/refresh', {
				method: 'POST'
			}),
			env,
			ctx
		);
	}
};

export { FlirtBattle } from './chat';
export { Session } from './session';
