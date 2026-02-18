import type { ReactNode } from 'react'
import clsx from 'clsx'

interface BaseDialogProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  titleClassName?: string
  contentClassName?: string
  overlayClassName?: string
}

export function BaseDialog({
  title,
  onClose,
  children,
  footer,
  titleClassName,
  contentClassName,
  overlayClassName,
}: BaseDialogProps) {
  return (
    <div className={clsx('dialog-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50', overlayClassName)}>
      <div className={clsx('dialog-content bg-bg-secondary border border-border-default rounded-lg w-full max-w-md mx-4', contentClassName)}>
        <div className="dialog-header flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 className={clsx('text-lg font-semibold text-text-primary', titleClassName)}>{title}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="dialog-body p-6">{children}</div>

        <div className="dialog-footer flex justify-end gap-3 px-6 py-4 border-t border-border-default">
          {footer}
        </div>
      </div>
    </div>
  )
}
