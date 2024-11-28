import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { poweredBy } from 'hono/powered-by';
import type { HTTPResponseError } from 'hono/types';

import { auth } from './auth';

const app = new Hono();

app.use('*', poweredBy());
app.use(
	'*',
	cors({
		origin: ['http://localhost:5173', 'https://juicylucy.ai'],
		credentials: true
	})
);

app.route('/auth', auth);

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

export default app;
export { Session } from './session';
