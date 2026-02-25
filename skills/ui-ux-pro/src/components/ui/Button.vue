<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary'
}>()
</script>

<template>
  <button
    :class="[
      'px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5',
      variant === 'secondary' ? 'bg-transparent text-primary border-2 border-primary' : 'bg-cta text-white'
    ]"
  >
    <slot />
  </button>
</template>
