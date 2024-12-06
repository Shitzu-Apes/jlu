import type { FlirtBattle } from './src/chat';
import type { Session } from './src/session';

declare module 'hono' {
	interface Env {
		Bindings: {
			KV: KVNamespace;
			SESSION: DurableObjectNamespace<Session>;
			FLIRTBATTLE: DurableObjectNamespace<FlirtBattle>;
			TWITTER_CLIENT_ID: string;
			TWITTER_CLIENT_SECRET: string;
			OPENAI_API_KEY: string;
			DEV: string;
			TWITTER_LUCY_USER_ID: string;
			TWITTER_BEARER_TOKEN: string;
		};
		Variables: {
			session: Auth;
		};
	}
}
