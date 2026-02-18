/**
 * Confirm Dialog component
 * Reusable confirmation modal matching app style
 */

import { BaseDialog } from './BaseDialog'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-accent-primary hover:bg-accent-primary/90',
  }

  return (
    <BaseDialog
      title={title}
      onClose={onCancel}
      footer={(
        <>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-primary border border-border-default rounded hover:bg-bg-hover transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded transition-colors ${variantClasses[variant]}`}
          >
            {confirmLabel}
          </button>
        </>
      )}
    >
      <p className="text-text-secondary">{message}</p>
    </BaseDialog>
  )
}

/**
 * Alert Dialog component
 * For displaying error/info messages (single button)
 */

interface AlertDialogProps {
  title: string
  message: string
  buttonLabel?: string
  variant?: 'error' | 'warning' | 'info' | 'success'
  onClose: () => void
}

export function AlertDialog({
  title,
  message,
  buttonLabel = 'OK',
  variant = 'info',
  onClose,
}: AlertDialogProps) {
  const variantColors = {
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-accent-primary',
    success: 'text-green-400',
  }

  return (
    <BaseDialog
      title={title}
      titleClassName={variantColors[variant]}
      onClose={onClose}
      footer={(
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white bg-accent-primary hover:bg-accent-primary/90 rounded transition-colors"
        >
          {buttonLabel}
        </button>
      )}
    >
      <p className="text-text-secondary">{message}</p>
    </BaseDialog>
  )
}
