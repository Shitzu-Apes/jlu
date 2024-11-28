import type { Session } from './src/session';

declare module 'hono' {
	interface Env {
		Bindings: {
			KV: KVNamespace;
			SESSION: DurableObjectNamespace<Session>;
			TWITTER_CLIENT_ID: string;
			TWITTER_CLIENT_SECRET: string;
		};
	}
}
