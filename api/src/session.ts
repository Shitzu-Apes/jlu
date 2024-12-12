import { DurableObject } from 'cloudflare:workers';
import type { Context, Env } from 'hono';
import { Hono } from 'hono';

import { handleTokenResponse, type Auth } from './auth';

export async function getLucySession(c: Context<Env>): Promise<Auth | Response> {
	const sessionDO = c.env.SESSION.get(c.env.SESSION.idFromName(c.env.TWITTER_LUCY_USER_ID));
	const response = await sessionDO.fetch(new URL(c.req.url).origin);

	if (!response.ok) {
		return c.text('Lucy session not found', 500);
	}

	let auth = (await response.json()) as Auth;

	// Check if token is expired
	if (Date.now() + 60_000 >= auth.expires_at) {
		const basicAuth = btoa(`${c.env.TWITTER_CLIENT_ID}:${c.env.TWITTER_CLIENT_SECRET}`);

		console.log('[refresh] Attempting token refresh for Lucy');
		const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
			method: 'POST',
			headers: {
				Authorization: `Basic ${basicAuth}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				client_id: c.env.TWITTER_CLIENT_ID,
				grant_type: 'refresh_token',
				refresh_token: auth.token.refresh_token
			})
		});

		const res = await handleTokenResponse(c, tokenResponse);
		if (res instanceof Response) {
			return res;
		}

		auth = res;
	}

	return auth;
}

export class Session extends DurableObject {
	private storage: DurableObjectStorage;
	private hono: Hono<Env>;
	private auth: Auth | undefined;

	constructor(
		readonly state: DurableObjectState,
		readonly env: Env
	) {
		super(state, env);
		this.storage = state.storage;
		this.state.blockConcurrencyWhile(async () => {
			this.auth = await this.storage.get('auth');
		});
		this.hono = new Hono();

		this.hono
			.get('*', (c) => {
				if (this.auth == null) {
					return c.text('', { status: 404 });
				}
				return c.json(this.auth);
			})
			.put('*', async (c) => {
				this.auth = await c.req.json();
				console.log('[auth]', this.auth);

				await this.storage.put('auth', this.auth);
				return c.text('', { status: 204 });
			})
			.delete('*', async (c) => {
				// Clear both the in-memory and stored auth
				this.auth = undefined;
				await this.storage.delete('auth');
				console.log('[auth] Session cleared');
				return c.text('', { status: 204 });
			});
	}

	async fetch(req: Request): Promise<Response> {
		return this.hono.fetch(req);
	}
}
