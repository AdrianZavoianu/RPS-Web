/**
 * Renders a single report section: title + table + SVG chart.
 * Used inside ReportPage for A4 preview rendering.
 */

import clsx from 'clsx'
import type { SectionData } from '../../api/reports'

interface ReportSectionRendererProps {
  section: SectionData
  flexGrow?: number
}

function isSummaryColumn(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return (
    normalized === 'avg' ||
    normalized === 'average' ||
    normalized === 'max' ||
    normalized === 'maximum' ||
    normalized === 'min' ||
    normalized === 'minimum'
  )
}

function isNumericValue(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim())
}

export function ReportSectionRenderer({ section, flexGrow = 0 }: ReportSectionRendererProps) {
  const isElementOrJoint = section.category === 'Element' || section.category === 'Joint'
  const titleLabel = section.unit ? `${section.title} (${section.unit})` : section.title
  const hasTable = Boolean(section.table)
  const chartMinHeight = hasTable ? 240 : 300

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
        <div className="report-data-table-wrap">
          <table className="report-data-table">
            <thead>
              <tr>
                {section.table.label_headers.map((h, i) => (
                  <th key={`lh-${i}`} className="report-label-header" title={h}>
                    {h}
                  </th>
                ))}
                {section.table.columns.map((col, i) => (
                  <th
                    key={`ch-${i}`}
                    className={clsx(
                      'report-data-header',
                      isSummaryColumn(col) && 'report-summary-header'
                    )}
                    title={col}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.label_columns.map((lc, li) => (
                    <td key={`l-${li}`} className="report-label-cell" title={lc}>
                      {lc}
                    </td>
                  ))}
                  {row.values.map((v, vi) => {
                    const column = section.table?.columns[vi] ?? ''
                    const summary = isSummaryColumn(column)
                    const numeric = isNumericValue(v)

                    return (
                      <td
                        key={`v-${vi}`}
                        className={clsx(
                          'report-data-cell',
                          summary && 'report-summary-cell',
                          numeric && 'report-numeric-cell'
                        )}
                        title={v}
                      >
                        {v}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SVG chart */}
      {section.chart_svg && (
        <div
          className="report-chart flex-1 min-h-0"
          style={{ minHeight: chartMinHeight, flexGrow: 1 }}
          dangerouslySetInnerHTML={{ __html: section.chart_svg }}
        />
      )}
    </div>
  )
}
