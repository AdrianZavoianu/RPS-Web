/**
 * Single A4 page for report preview.
 * 525×743px white div with header, sections, and footer.
 */

import type { SectionData } from '../../api/reports'
import { ReportSectionRenderer } from './ReportSectionRenderer'

interface ReportPageProps {
  sections: SectionData[]
  projectName: string
  resultSetName: string
  pageNumber: number
}

export function ReportPage({ sections, projectName, resultSetName, pageNumber }: ReportPageProps) {
  // Distribute flex-grow evenly across sections so they fill available space
  const grow = sections.length > 0 ? 1 : 0

  return (
    <div className="report-page">
      {/* Header */}
      <div className="report-page-header">
        <span className="rps-logo report-page-logo" aria-label="RPS logo" role="img" />
        <div className="report-page-header-meta">
          <span className="report-page-project-name">{projectName}</span>
          <span className="report-page-result-set">{resultSetName}</span>
        </div>
      </div>

      {/* Content */}
      <div className="report-page-content">
        {sections.map((section, i) => (
          <ReportSectionRenderer key={i} section={section} flexGrow={grow} />
        ))}
      </div>

      {/* Footer */}
      <div className="report-page-footer">Page {pageNumber}</div>
    </div>
  )
}
