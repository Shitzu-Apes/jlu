import { DurableObject } from 'cloudflare:workers';
import type { Env } from 'hono';
import { Hono } from 'hono';

import type { Auth } from './auth';

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
			});
	}

	async fetch(req: Request): Promise<Response> {
		return this.hono.fetch(req);
	}
}
