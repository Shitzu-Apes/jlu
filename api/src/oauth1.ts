import { createHmac } from 'crypto';
import OAuth from 'oauth-1.0a';

function hash_function_sha1(base_string: string, key: string) {
	return createHmac('sha1', key).update(base_string).digest('base64');
}

export async function twitterRequest(
	method: string,
	url: string,
	params: Record<string, string>,
	credentials: {
		apiKey: string;
		apiSecret: string;
		accessToken: string;
		accessSecret: string;
	},
	body?: BodyInit | URLSearchParams,
	isFormUrlEncoded: boolean = false
): Promise<Response> {
	const oauth = new OAuth({
		consumer: {
			key: credentials.apiKey,
			secret: credentials.apiSecret
		},
		signature_method: 'HMAC-SHA1',
		hash_function: hash_function_sha1
	});

	const formData: Record<string, string> = {};
	if (isFormUrlEncoded && body instanceof URLSearchParams) {
		for (const [key, value] of body.entries()) {
			formData[key] = value;
		}
	}

	const requestData = {
		url,
		method,
		data: {
			...params,
			...formData
		}
	};

	const token = {
		key: credentials.accessToken,
		secret: credentials.accessSecret
	};

	const headers: Record<string, string> = {
		...oauth.toHeader(oauth.authorize(requestData, token))
	};

	if (!isFormUrlEncoded) {
		headers['Content-Type'] = 'application/json';
	} else {
		headers['Content-Type'] = 'application/x-www-form-urlencoded';
	}

	return fetch(url, {
		method,
		headers,
		body
	});
}
