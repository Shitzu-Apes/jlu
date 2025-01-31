<script lang="ts">
	export let account: string;

	$: isNamed = account.includes('.');

	function formatAccountName(account: string) {
		try {
			const [name] = account.split('.');
			const isLong = name.length > 10;
			return isLong ? name.slice(0, 10) + '...' : account;
		} catch (_) {
			return account;
		}
	}

	$: formatName = isNamed
		? formatAccountName(account)
		: account.slice(0, 4) + '...' + account.slice(-4);

	let className: string = '';
	export let asLink = false;
	export { className as class };
</script>

<svelte:element
	this={asLink ? 'a' : 'div'}
	href={asLink ? `/profile/${account}` : undefined}
	class="w-full flex flex-1 overflow-hidden text-ellipsis {asLink ? 'hover:underline' : ''}"
>
	<div class="w-full flex items-center gap-1 flex-1">
		<slot />
		<span class="overflow-hidden text-ellipsis {className}">{formatName}</span>
	</div>
</svelte:element>
