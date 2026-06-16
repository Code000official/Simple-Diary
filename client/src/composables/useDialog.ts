import { ref, reactive } from 'vue'

export interface DialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmClass?: string
  alertOnly?: boolean
}

export function useDialog() {
  const show = ref(false)
  const options = reactive<DialogOptions>({ message: '' })
  let resolveCallback: ((value: boolean) => void) | null = null

  function confirm(opts: DialogOptions): Promise<boolean> {
    Object.assign(options, { title: '', confirmText: '确定', cancelText: '取消', confirmClass: 'btn-primary', alertOnly: false, ...opts })
    show.value = true
    return new Promise(resolve => {
      resolveCallback = resolve
    })
  }

  function onConfirm(): void {
    show.value = false
    resolveCallback?.(true)
    resolveCallback = null
  }

  function onCancel(): void {
    show.value = false
    resolveCallback?.(false)
    resolveCallback = null
  }

  return { show, options, confirm, onConfirm, onCancel }
}
