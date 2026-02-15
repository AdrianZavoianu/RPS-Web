/**
 * Renders a single report section: title + table + SVG chart.
 * Used inside ReportPage for A4 preview rendering.
 */

import type { SectionData } from '../../api/reports'

interface ReportSectionRendererProps {
  section: SectionData
  flexGrow?: number
}

export function ReportSectionRenderer({ section, flexGrow = 0 }: ReportSectionRendererProps) {
  const isElementOrJoint = section.category === 'Element' || section.category === 'Joint'
  const titleLabel = section.unit ? `${section.title} (${section.unit})` : section.title

  return (
    <div className="report-section flex flex-col" style={{ flexGrow }}>
      {/* Title */}
      <div className="report-section-title">{titleLabel}</div>

      {/* Subtitle for Element/Joint */}
      {isElementOrJoint && (
        <div className="report-top10-label">Top 10 by absolute average</div>
      )}

      {/* Table */}
      {section.table && (
        <table className="report-data-table">
          <thead>
            <tr>
              {section.table.label_headers.map((h, i) => (
                <th key={`lh-${i}`} className="report-label-header">
                  {h}
                </th>
              ))}
              {section.table.columns.map((col, i) => (
                <th key={`ch-${i}`}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.label_columns.map((lc, li) => (
                  <td key={`l-${li}`} className="report-label-cell">
                    {lc}
                  </td>
                ))}
                {row.values.map((v, vi) => (
                  <td key={`v-${vi}`}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* SVG chart */}
      {section.chart_svg && (
        <div
          className="report-chart flex-1 min-h-0"
          dangerouslySetInnerHTML={{ __html: section.chart_svg }}
        />
      )}
    </div>
  )
}
