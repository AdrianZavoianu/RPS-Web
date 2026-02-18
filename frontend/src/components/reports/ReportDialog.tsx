import { ReportDialogView } from './ReportDialogView'
import { useReportDialogState } from './useReportDialogState'

interface ReportDialogProps {
  onClose: () => void
  projectName: string
  projectSlug: string
}

export function ReportDialog({ onClose, projectName, projectSlug }: ReportDialogProps) {
  const state = useReportDialogState({ onClose, projectName, projectSlug })

  return <ReportDialogView onClose={onClose} projectName={projectName} state={state} />
}
