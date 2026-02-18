import { ExportDialogView } from './ExportDialogView'
import { useExportDialogState } from './useExportDialogState'

interface ExportDialogProps {
  projectSlug: string
  onClose: () => void
}

export function ExportDialog({ projectSlug, onClose }: ExportDialogProps) {
  const state = useExportDialogState({ projectSlug, onClose })

  return <ExportDialogView onClose={onClose} state={state} />
}
