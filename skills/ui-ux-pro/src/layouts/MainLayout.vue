<script setup lang="ts">
// Navbar placeholder
</script>

<template>
  <div class="min-h-screen bg-background">
    <nav class="p-6 flex justify-between items-center glass-effect sticky top-0 z-50">
      <div class="text-xl font-bold text-primary">Brand</div>
      <div class="flex gap-4">
        <a href="#" class="text-sm font-medium hover:text-primary transition-colors">Home</a>
        <a href="#" class="text-sm font-medium hover:text-primary transition-colors">Features</a>
      </div>
    </nav>
    <main class="max-w-7xl mx-auto px-6 py-8">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.glass-effect {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
}
</style>
