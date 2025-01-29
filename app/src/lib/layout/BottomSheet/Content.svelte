<div class="h-full flex flex-col">
	<header class="flex-shrink-0 min-h-[4rem] flex items-center border-b border-purple-900/20">
		<slot name="header" />
	</header>
	<div class="flex-1 overflow-y-auto">
		<slot />
	</div>
</div>
