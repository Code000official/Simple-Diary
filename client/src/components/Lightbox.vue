<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="show" class="lightbox-overlay" @click="close">
        <img :src="src" alt="" class="lightbox-img" @click.stop />
        <button class="lightbox-close" @click="close">✕</button>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
defineProps<{ show: boolean; src: string }>()
const emit = defineEmits<{ close: [] }>()
function close(): void { emit('close') }
</script>

<style scoped>
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  cursor: zoom-out;
}

.lightbox-img {
  max-width: 95%;
  max-height: 95%;
  object-fit: contain;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
  cursor: default;
}

.lightbox-close {
  position: fixed;
  top: var(--space-md);
  right: var(--space-md);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 1.3rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast);
}

.lightbox-close:hover {
  background: rgba(0, 0, 0, 0.8);
}
</style>
