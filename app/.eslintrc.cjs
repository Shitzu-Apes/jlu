module.exports = {
	extends: ['../.eslintrc.cjs', 'plugin:svelte/recommended'],
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
		ecmaFeatures: {
			arrowFunctions: true
		},
		extraFileExtensions: ['.svelte']
	},
	overrides: [
		{
			files: ['*.svelte'],
			parser: 'svelte-eslint-parser',
			parserOptions: {
				parser: '@typescript-eslint/parser'
			},
			rules: {
				'svelte/valid-compile': ['off'],
				'svelte/html-self-closing': ['error']
			}
		}
	]
};
