module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	extends: [
		'eslint:recommended',
		'plugin:import/recommended',
		'plugin:import/typescript',
		'plugin:prettier/recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended'
	],
	plugins: ['@typescript-eslint', 'prettier', 'import'],
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
		ecmaFeatures: {
			arrowFunctions: true
		}
	},
	env: {
		browser: true,
		es6: true,
		amd: true,
		node: true
	},
	settings: {
		'import/parsers': {
			'@typescript-eslint/parser': ['.ts']
		},
		'import/resolver': {
			typescript: {
				alwaysTryTypes: true
			}
		}
	},
	rules: {
		'no-case-declarations': 'off',
		'import/order': [
			'error',
			{
				groups: [['builtin', 'external'], 'parent', ['sibling', 'index']],
				'newlines-between': 'always',
				alphabetize: {
					order: 'asc'
				}
			}
		],
		'import/no-duplicates': 'off',
		'import/no-unresolved': [
			'error',
			{
				// FIXME
				ignore: [
					'\\$app/.*',
					'\\$lib/.*',
					'svelte/.*',
					'virtual:.*',
					'\\$env/.*',
					'cloudflare:workers'
				]
			}
		],
		'@typescript-eslint/no-unused-vars': [
			'error',
			{
				argsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
				destructuredArrayIgnorePattern: '^_',
				varsIgnorePattern: '^_'
			}
		]
	}
};
