import { createHmac, randomBytes } from 'crypto';

export function generateNonce(): string {
	return randomBytes(32)
		.toString('base64')
		.replace(/[^a-zA-Z0-9]/g, '');
}

export function generateTimestamp(): string {
	return Math.floor(Date.now() / 1000).toString();
}

export function encodeParameter(str: string): string {
	return encodeURIComponent(str)
		.replace(/!/g, '%21')
		.replace(/\*/g, '%2A')
		.replace(/'/g, '%27')
		.replace(/\(/g, '%28')
		.replace(/\)/g, '%29');
}

export function createSignature(
	method: string,
	url: string,
	parameters: Record<string, string>,
	consumerSecret: string,
	tokenSecret: string
): string {
	const parameterString = Object.keys(parameters)
		.sort()
		.map((key) => `${encodeParameter(key)}=${encodeParameter(parameters[key])}`)
		.join('&');

	const signatureBaseString = [
		method.toUpperCase(),
		encodeParameter(url),
		encodeParameter(parameterString)
	].join('&');

	const signingKey = `${encodeParameter(consumerSecret)}&${encodeParameter(tokenSecret)}`;
	return createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
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
	body?: BodyInit | FormData,
	isMultipart: boolean = false
): Promise<Response> {
	const oauthParams = {
		oauth_consumer_key: credentials.apiKey,
		oauth_nonce: generateNonce(),
		oauth_signature_method: 'HMAC-SHA1',
		oauth_timestamp: generateTimestamp(),
		oauth_token: credentials.accessToken,
		oauth_version: '1.0',
		...params
	};

	const signature = createSignature(
		method,
		url,
		oauthParams,
		credentials.apiSecret,
		credentials.accessSecret
	);

	const oauthHeader =
		'OAuth ' +
		Object.entries({
			...oauthParams,
			oauth_signature: signature
		})
			.map(([key, value]) => `${encodeParameter(key)}="${encodeParameter(value)}"`)
			.join(', ');

	const headers: Record<string, string> = {
		Authorization: oauthHeader
	};

	if (!isMultipart) {
		headers['Content-Type'] = 'application/json';
	}
	console.log(url, method, headers, body);

	return fetch(url, {
		method,
		headers,
		body
	});
}
