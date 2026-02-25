<script setup lang="ts">
import { type Component } from 'vue'

defineProps<{
  title: string
  description: string
  icon?: Component
}>()
</script>

<template>
  <div class="bg-white/60 backdrop-blur-md border border-white/20 p-6 rounded-xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
    <div class="mb-4 text-primary bg-primary/10 w-12 h-12 flex items-center justify-center rounded-lg group-hover:bg-primary group-hover:text-white transition-colors duration-300">
      <component :is="icon" v-if="icon" class="w-6 h-6" />
    </div>
    <h3 class="text-lg font-bold mb-2 text-primary">{{ title }}</h3>
    <p class="text-gray-600">{{ description }}</p>
  </div>
</template>
