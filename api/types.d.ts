import type { FlirtBattle } from './src/chat';
import type { Session } from './src/session';
import type { Tweets } from './src/tweet';

interface EnvBindings {
	KV: KVNamespace;
	SESSION: DurableObjectNamespace<Session>;
	FLIRTBATTLE: DurableObjectNamespace<FlirtBattle>;
	TWEETS: DurableObjectNamespace<Tweets>;
	TWITTER_CLIENT_ID: string;
	TWITTER_CLIENT_SECRET: string;
	CEREBRAS_API_URL: string;
	CEREBRAS_API_KEY: string;
	OPENAI_API_KEY: string;
	LEONARDO_API_KEY: string;
	TWITTER_LUCY_USER_ID: string;
	TWITTER_BEARER_TOKEN: string;
	NEAR_SECRET_KEY: string;
	NEAR_ACCOUNT_ID: string;
	JLU_TOKEN_ID: string;
	JLU_PER_POINT: string;
}

declare module 'hono' {
	interface Env {
		Bindings: EnvBindings;
		Variables: {
			session: Auth;
		};
	}
}
