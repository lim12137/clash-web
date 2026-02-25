<script setup lang="ts">
import MainLayout from '../layouts/MainLayout.vue'
import Button from '../components/ui/Button.vue'
import Card from '../components/ui/Card.vue'
import { BarChart3, Users, Shield } from 'lucide-vue-next'
</script>

<template>
  <MainLayout>
    <div class="space-y-8">
      <!-- Hero Section -->
      <section class="text-center py-16 space-y-6">
        <h1 class="text-5xl font-bold text-[#1E1B4B]">Modern SaaS Dashboard</h1>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">
          Experience the future of interface design with our glassmorphism-inspired components.
        </p>
        <div class="flex justify-center gap-4">
          <Button variant="primary">Get Started</Button>
          <Button variant="secondary">Learn More</Button>
        </div>
      </section>

      <!-- Features Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Analytics" description="Real-time data visualization" :icon="BarChart3" />
        <Card title="Management" description="Efficient team collaboration" :icon="Users" />
        <Card title="Security" description="Enterprise-grade protection" :icon="Shield" />
      </div>
    </div>
  </MainLayout>
</template>
