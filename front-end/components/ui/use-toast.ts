"use client"

import * as React from "react"
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast"
import { useToast as useToastHook } from "@/components/ui/use-toast-hook"

export { useToast } from "@/components/ui/use-toast-hook"

type ToastProps = React.ComponentProps<typeof Toast>

const ToastContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & ToastProps>(
  ({ className, ...props }, ref) => {
    const { removeToast } = useToastHook()

    return (
      <Toast ref={ref} className={className} {...props} onSwipeEnd={() => removeToast(props.id)}>
        {props.title && <ToastTitle>{props.title}</ToastTitle>}
        {props.description && <ToastDescription>{props.description}</ToastDescription>}
        <ToastClose />
      </Toast>
    )
  },
)
ToastContainer.displayName = "ToastContainer"

export { ToastProvider, ToastViewport, ToastContainer as Toast, ToastClose, ToastDescription, ToastTitle }

export function useToast() {
  return useToastHook()
}
