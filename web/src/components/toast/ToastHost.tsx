import { useState } from 'react'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '../ui/toast'

export type ToastMessage = {
  title: string
  description?: string
}

let pushToast: ((msg: ToastMessage) => void) | null = null

export function toast(msg: ToastMessage) {
  pushToast?.(msg)
}

export function ToastHost() {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<ToastMessage | null>(null)

  pushToast = (next) => {
    setMsg(next)
    setOpen(false)
    requestAnimationFrame(() => setOpen(true))
  }

  return (
    <ToastProvider swipeDirection="right">
      <Toast open={open} onOpenChange={setOpen}>
        <div className="grid gap-1">
          <ToastTitle>{msg?.title ?? ''}</ToastTitle>
          {msg?.description ? <ToastDescription>{msg.description}</ToastDescription> : null}
        </div>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  )
}

