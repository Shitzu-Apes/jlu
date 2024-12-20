import type { FlirtBattle } from './src/chat';
import type { TweetSearch } from './src/do/tweets';
import type { Tweets } from './src/do/tweets';
import type { Session } from './src/session';

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

interface EnvBindings {
	KV: KVNamespace;
	SESSION: DurableObjectNamespace<Session>;
	FLIRTBATTLE: DurableObjectNamespace<FlirtBattle>;
	TWEETS: DurableObjectNamespace<Tweets>;
	TWEET_SEARCH: DurableObjectNamespace<TweetSearch>;
	KNOWLEDGE: DurableObjectNamespace<Knowledge>;
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
	TWITTER_API_KEY: string;
	TWITTER_API_SECRET: string;
	TWITTER_ACCESS_TOKEN: string;
	TWITTER_ACCESS_SECRET: string;
	TWITTER_USERNAME: string;
	TWITTER_PASSWORD: string;
	TWITTER_EMAIL: string;
	TWITTER_2FA_SECRET: string;
	TWITTER_COOKIE?: string;
}

declare module 'hono' {
	interface Env {
		Bindings: EnvBindings;
		Variables: {
			session: Auth;
		};
	}
}
