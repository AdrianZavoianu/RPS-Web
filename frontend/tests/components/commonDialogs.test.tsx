import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BaseDialog } from '../../src/components/common/BaseDialog'
import { AlertDialog, ConfirmDialog } from '../../src/components/common/ConfirmDialog'

describe('BaseDialog', () => {
  it('renders title, body, footer and closes via close button', () => {
    const onClose = vi.fn()

    render(
      <BaseDialog
        title="Dialog Title"
        onClose={onClose}
        footer={<button type="button">Footer Action</button>}
      >
        <p>Dialog body content</p>
      </BaseDialog>
    )

    expect(screen.getByRole('heading', { name: 'Dialog Title' })).toBeInTheDocument()
    expect(screen.getByText('Dialog body content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Footer Action' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ConfirmDialog', () => {
  it('uses default labels and triggers confirm/cancel actions', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <ConfirmDialog
        title="Delete result set"
        message="This action cannot be undone."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('applies danger style variant to confirm action', () => {
    render(
      <ConfirmDialog
        title="Delete project"
        message="Confirm delete"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-red-600')
  })
})

describe('AlertDialog', () => {
  it('renders variant styling and closes from both controls', () => {
    const onClose = vi.fn()

    render(
      <AlertDialog
        title="Warning"
        message="The report contains warnings."
        buttonLabel="Dismiss"
        variant="warning"
        onClose={onClose}
      />
    )

    expect(screen.getByRole('heading', { name: 'Warning' })).toHaveClass('text-yellow-400')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))

    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
