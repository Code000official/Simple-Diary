<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="show" class="modal-overlay" @click.self="onCancel">
        <div class="modal-content">
          <h3 class="modal-title">{{ options.title }}</h3>
          <p class="modal-message">{{ options.message }}</p>
          <div class="modal-actions">
            <button v-if="!options.alertOnly" class="btn btn-outline" @click="onCancel">{{ options.cancelText || '取消' }}</button>
            <button :class="['btn', options.confirmClass || 'btn-primary']" @click="onConfirm">{{ options.confirmText || '确定' }}</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import type { DialogOptions } from '../composables/useDialog'

defineProps<{
  show: boolean
  options: DialogOptions
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function onConfirm(): void { emit('confirm') }
function onCancel(): void { emit('cancel') }
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  max-width: 420px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.modal-title {
  font-family: var(--font-serif);
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--color-text);
}

.modal-message {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: var(--space-lg);
}

.modal-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
