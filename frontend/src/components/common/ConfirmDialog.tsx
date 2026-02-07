/**
 * Confirm Dialog component
 * Reusable confirmation modal matching app style
 */

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
    <div className="dialog-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="dialog-content bg-bg-secondary border border-border-default rounded-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="dialog-header flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onCancel}
            className="text-text-secondary hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="dialog-body p-6">
          <p className="text-text-secondary">{message}</p>
        </div>

        {/* Footer */}
        <div className="dialog-footer flex justify-end gap-3 px-6 py-4 border-t border-border-default">
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
        </div>
      </div>
    </div>
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
    <div className="dialog-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="dialog-content bg-bg-secondary border border-border-default rounded-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="dialog-header flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 className={`text-lg font-semibold ${variantColors[variant]}`}>{title}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="dialog-body p-6">
          <p className="text-text-secondary">{message}</p>
        </div>

        {/* Footer */}
        <div className="dialog-footer flex justify-end px-6 py-4 border-t border-border-default">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-accent-primary hover:bg-accent-primary/90 rounded transition-colors"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
