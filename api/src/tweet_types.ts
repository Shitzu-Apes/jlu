import type { Hairstyle } from './prompt';
import type { Outfit } from './prompt';

export type TweetSearchData = {
	id: string;
	text: string;
	author_id: string;
	created_at: string;
	public_metrics?: {
		like_count: number;
		reply_count: number;
		retweet_count: number;
		quote_count: number;
		impression_count: number;
	};
	referenced_tweets?: {
		type: string;
		id: string;
	}[];
};

export type TweetSearchUser = {
	id: string;
	name: string;
	username: string;
	verified: boolean;
	description: string;
	created_at: string;
	public_metrics: {
		followers_count: number;
		following_count: number;
		tweet_count: number;
		like_count: number;
		listed_count: number;
	};
};

export type TweetSearchResponse = {
	data: TweetSearchData[];
	includes: {
		users: TweetSearchUser[];
	};
};

export type EngageableTweet = {
	tweet: TweetSearchData & {
		author: TweetSearchUser;
	};
	thread?: TweetSearchData[];
	lucyTweets?: string[];
	imagePrompt?: string;
	outfit?: Outfit;
	hairstyle?: Hairstyle;
	imageGenerationId?: string;
	imageUrl?: string;
};
