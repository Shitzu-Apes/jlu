module.exports = {
	...require('../.prettierrc.cjs'),
	plugins: ['prettier-plugin-svelte'],
	overrides: [
		{
			files: '*.svelte',
			options: {
				parser: 'svelte'
			}
		}
	]
};
