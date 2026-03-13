/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'

const importResultsRoutePageModule = () => import('../../results/pages/ResultsRoutePage')
const importMaxMinRoutePageModule = () => import('../../results/pages/MaxMinRoutePage')
const importElementResultsRoutePageModule = () => import('../../results/pages/ElementResultsRoutePage')
const importFoundationResultsRoutePageModule = () =>
  import('../../results/pages/FoundationResultsRoutePage')
const importTimeSeriesRoutePageModule = () => import('../../results/pages/TimeSeriesRoutePage')
const importProjectSettingsModule = () => import('../../../components/projects/ProjectSettings')

const importImportDialogModule = () => import('../../../components/imports/ImportDialog')
const importPushoverImportDialogModule = () =>
  import('../../../components/imports/PushoverImportDialog')
const importExportDialogModule = () => import('../../../components/exports/ExportDialog')
const importReportDialogModule = () => import('../../../components/reports/ReportDialog')
const importComparisonDialogModule = () =>
  import('../../../components/comparisons/ComparisonSetDialog')

export const ResultsRoutePage = lazy(() =>
  importResultsRoutePageModule().then((module) => ({
    default: module.ResultsRoutePage,
  }))
)

export const MaxMinRoutePage = lazy(() =>
  importMaxMinRoutePageModule().then((module) => ({
    default: module.MaxMinRoutePage,
  }))
)

export const ElementResultsRoutePage = lazy(() =>
  importElementResultsRoutePageModule().then((module) => ({
    default: module.ElementResultsRoutePage,
  }))
)

export const FoundationResultsRoutePage = lazy(() =>
  importFoundationResultsRoutePageModule().then((module) => ({
    default: module.FoundationResultsRoutePage,
  }))
)

export const TimeSeriesRoutePage = lazy(() =>
  importTimeSeriesRoutePageModule().then((module) => ({
    default: module.TimeSeriesRoutePage,
  }))
)

export const ProjectSettings = lazy(() =>
  importProjectSettingsModule().then((module) => ({
    default: module.ProjectSettings,
  }))
)

export const ImportDialog = lazy(() =>
  importImportDialogModule().then((module) => ({
    default: module.ImportDialog,
  }))
)

export const PushoverImportDialog = lazy(() =>
  importPushoverImportDialogModule().then((module) => ({
    default: module.PushoverImportDialog,
  }))
)

export const ExportDialog = lazy(() =>
  importExportDialogModule().then((module) => ({
    default: module.ExportDialog,
  }))
)

export const ReportDialog = lazy(() =>
  importReportDialogModule().then((module) => ({
    default: module.ReportDialog,
  }))
)

export const ComparisonSetDialog = lazy(() =>
  importComparisonDialogModule().then((module) => ({
    default: module.ComparisonSetDialog,
  }))
)

export const workspacePrefetch = {
  comparisonDialog: () => {
    void importComparisonDialogModule()
  },
  exportDialog: () => {
    void importExportDialogModule()
  },
  importDialog: () => {
    void importImportDialogModule()
  },
  pushoverImportDialog: () => {
    void importPushoverImportDialogModule()
  },
  reportDialog: () => {
    void importReportDialogModule()
  },
} as const
