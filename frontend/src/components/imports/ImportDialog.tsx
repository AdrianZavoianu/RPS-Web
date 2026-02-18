import { ImportDialogView } from './ImportDialogView'
import { useImportDialogState } from './useImportDialogState'

interface ImportDialogProps {
  mode?: 'nltha' | 'time-series'
  onClose: () => void
  onComplete?: (resultSetId: number) => void
  projectName?: string
  projectSlug: string
}

export function ImportDialog({
  mode = 'nltha',
  onClose,
  onComplete,
  projectName,
  projectSlug,
}: ImportDialogProps) {
  const state = useImportDialogState({
    mode,
    onClose,
    onComplete,
    projectName,
    projectSlug,
  })

  return <ImportDialogView state={state} />
}
