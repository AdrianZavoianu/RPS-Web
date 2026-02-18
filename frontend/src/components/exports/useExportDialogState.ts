import { useEffect, useState } from 'react'
import { downloadExportFile } from '../../api/exports'
import { useCancelExport, useExportJob, useStartExport } from '../../hooks/useExports'
import { useAvailableResultTypes, useResultSets } from '../../hooks/useResults'
import { getApiErrorMessage } from '../../types/errors'

export type ExportStep = 'configure' | 'exporting' | 'complete'

interface UseExportDialogStateParams {
  projectSlug: string
  onClose: () => void
}

export interface UseExportDialogStateResult {
  availableTypes: ReturnType<typeof useAvailableResultTypes>['data']
  canStartExport: boolean
  exportError: string | null
  exportJob: ReturnType<typeof useExportJob>['data']
  format: 'excel' | 'csv'
  includeSummary: boolean
  isCancelling: boolean
  resultSets: ReturnType<typeof useResultSets>['data']
  selectedDirections: string[]
  selectedElementTypes: string[]
  selectedGlobalTypes: string[]
  selectedJointTypes: string[]
  selectedResultSetId: number | null
  step: ExportStep
  handleCancelExport: () => Promise<void>
  handleDialogClose: () => void
  handleDownload: () => Promise<void>
  handleStartExport: () => Promise<void>
  setFormat: (value: 'excel' | 'csv') => void
  setIncludeSummary: (value: boolean) => void
  setSelectedResultSetId: (id: number) => void
  toggleDirection: (direction: string) => void
  toggleElementType: (type: string) => void
  toggleGlobalType: (type: string) => void
  toggleJointType: (type: string) => void
  selectAllElementTypes: () => void
  selectAllGlobalTypes: () => void
  selectAllJointTypes: () => void
  clearElementTypes: () => void
  clearGlobalTypes: () => void
  clearJointTypes: () => void
}

function toggleItem(value: string, values: string[]): string[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value)
  }
  return [...values, value]
}

export function useExportDialogState({
  projectSlug,
  onClose,
}: UseExportDialogStateParams): UseExportDialogStateResult {
  const [step, setStep] = useState<ExportStep>('configure')
  const [selectedResultSetId, setSelectedResultSetId] = useState<number | null>(null)
  const [selectedGlobalTypes, setSelectedGlobalTypes] = useState<string[]>([])
  const [selectedElementTypes, setSelectedElementTypes] = useState<string[]>([])
  const [selectedJointTypes, setSelectedJointTypes] = useState<string[]>([])
  const [selectedDirections, setSelectedDirections] = useState<string[]>(['X', 'Y'])
  const [format, setFormat] = useState<'excel' | 'csv'>('excel')
  const [includeSummary, setIncludeSummary] = useState(true)
  const [exportJobId, setExportJobId] = useState<number | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const { data: resultSets } = useResultSets(projectSlug)
  const { data: availableTypes } = useAvailableResultTypes(projectSlug)
  const startExport = useStartExport(projectSlug)
  const cancelExport = useCancelExport(projectSlug)
  const { data: exportJob } = useExportJob(projectSlug, exportJobId)

  useEffect(() => {
    if (resultSets?.length && !selectedResultSetId) {
      setSelectedResultSetId(resultSets[0].id)
    }
  }, [resultSets, selectedResultSetId])

  useEffect(() => {
    if (!availableTypes) {
      return
    }

    const hasNoSelections =
      selectedGlobalTypes.length === 0 &&
      selectedElementTypes.length === 0 &&
      selectedJointTypes.length === 0
    if (!hasNoSelections) {
      return
    }

    setSelectedGlobalTypes(availableTypes.global_results.map((item) => item.type))
    setSelectedElementTypes(availableTypes.element_results.map((item) => item.type))
    setSelectedJointTypes(availableTypes.joint_results.map((item) => item.type))
  }, [availableTypes, selectedGlobalTypes, selectedElementTypes, selectedJointTypes])

  useEffect(() => {
    if (exportJob?.status === 'completed' || exportJob?.status === 'failed') {
      setStep('complete')
    }
  }, [exportJob])

  const hasAnySelection =
    selectedGlobalTypes.length > 0 ||
    selectedElementTypes.length > 0 ||
    selectedJointTypes.length > 0

  const canStartExport = Boolean(selectedResultSetId && hasAnySelection)

  const handleStartExport = async () => {
    if (!selectedResultSetId || !hasAnySelection) {
      return
    }

    setExportError(null)
    setStep('exporting')

    try {
      const job = await startExport.mutateAsync({
        result_set_id: selectedResultSetId,
        result_types: selectedGlobalTypes,
        element_types: selectedElementTypes,
        joint_types: selectedJointTypes,
        directions: selectedDirections,
        format,
        include_summary: includeSummary,
      })
      setExportJobId(job.id)
    } catch (error) {
      setExportError(getApiErrorMessage(error, 'Failed to start export'))
      setStep('configure')
    }
  }

  const handleCancelExport = async () => {
    if (!exportJobId) {
      onClose()
      return
    }

    setExportError(null)
    try {
      await cancelExport.mutateAsync(exportJobId)
      onClose()
    } catch (error) {
      setExportError(getApiErrorMessage(error, 'Failed to cancel export'))
    }
  }

  const handleDialogClose = () => {
    if (step === 'exporting') {
      void handleCancelExport()
      return
    }
    onClose()
  }

  const handleDownload = async () => {
    if (!exportJobId) {
      setExportError('Export job is missing')
      return
    }

    if (!exportJob?.file_name) {
      setExportError('Export file metadata is missing')
      return
    }

    setExportError(null)
    try {
      const blob = await downloadExportFile(projectSlug, exportJobId)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = exportJob.file_name
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      setExportError(getApiErrorMessage(error, 'Failed to download export file'))
    }
  }

  const setSelectedResultSet = (id: number) => {
    setSelectedResultSetId(id)
  }

  const toggleDirection = (direction: string) => {
    setSelectedDirections((prev) => toggleItem(direction, prev))
  }

  const toggleGlobalType = (type: string) => {
    setSelectedGlobalTypes((prev) => toggleItem(type, prev))
  }

  const toggleElementType = (type: string) => {
    setSelectedElementTypes((prev) => toggleItem(type, prev))
  }

  const toggleJointType = (type: string) => {
    setSelectedJointTypes((prev) => toggleItem(type, prev))
  }

  const selectAllGlobalTypes = () => {
    setSelectedGlobalTypes(availableTypes?.global_results.map((item) => item.type) ?? [])
  }

  const selectAllElementTypes = () => {
    setSelectedElementTypes(availableTypes?.element_results.map((item) => item.type) ?? [])
  }

  const selectAllJointTypes = () => {
    setSelectedJointTypes(availableTypes?.joint_results.map((item) => item.type) ?? [])
  }

  const clearGlobalTypes = () => {
    setSelectedGlobalTypes([])
  }

  const clearElementTypes = () => {
    setSelectedElementTypes([])
  }

  const clearJointTypes = () => {
    setSelectedJointTypes([])
  }

  return {
    availableTypes,
    canStartExport,
    exportError,
    exportJob,
    format,
    includeSummary,
    isCancelling: cancelExport.isPending,
    resultSets,
    selectedDirections,
    selectedElementTypes,
    selectedGlobalTypes,
    selectedJointTypes,
    selectedResultSetId,
    step,
    clearElementTypes,
    clearGlobalTypes,
    clearJointTypes,
    handleCancelExport,
    handleDialogClose,
    handleDownload,
    handleStartExport,
    selectAllElementTypes,
    selectAllGlobalTypes,
    selectAllJointTypes,
    setFormat,
    setIncludeSummary,
    setSelectedResultSetId: setSelectedResultSet,
    toggleDirection,
    toggleElementType,
    toggleGlobalType,
    toggleJointType,
  }
}
