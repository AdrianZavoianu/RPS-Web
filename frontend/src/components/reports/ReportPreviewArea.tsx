/**
 * Scrollable container that paginates sections into A4 ReportPage components.
 * Uses greedy bin-packing to distribute sections across pages.
 */

import { useMemo } from 'react'
import type { SectionData } from '../../api/reports'
import { ReportPage } from './ReportPage'

interface ReportPreviewAreaProps {
  sections: SectionData[]
  projectName: string
  resultSetName: string
  isLoading?: boolean
}

// A4 page dimensions (px) matching CSS
const PAGE_CONTENT_HEIGHT = 641 // 743 - 40(margins) - 34(header) - 18(footer) - 10(buffer)
const SECTION_GAP = 8
const TITLE_HEIGHT = 20
const TABLE_HEADER_HEIGHT = 16
const TABLE_ROW_HEIGHT = 14
const SUBTITLE_HEIGHT = 14 // "Top 10 by absolute average"
const GLOBAL_CHART_HEIGHT = 200
const ELEMENT_JOINT_CHART_HEIGHT = 150

function estimateSectionHeight(section: SectionData): number {
  let h = TITLE_HEIGHT

  if (section.category === 'Element' || section.category === 'Joint') {
    h += SUBTITLE_HEIGHT
  }

  if (section.table) {
    h += TABLE_HEADER_HEIGHT + section.table.rows.length * TABLE_ROW_HEIGHT
  }

  if (section.chart_svg) {
    h +=
      section.category === 'Global' ? GLOBAL_CHART_HEIGHT : ELEMENT_JOINT_CHART_HEIGHT
  }

  return h
}

function paginateSections(sections: SectionData[]): SectionData[][] {
  if (sections.length === 0) return []

  const pages: SectionData[][] = []
  let currentPage: SectionData[] = []
  let currentHeight = 0

  for (const section of sections) {
    const sectionH = estimateSectionHeight(section)
    const needed = currentPage.length > 0 ? sectionH + SECTION_GAP : sectionH

    if (currentPage.length > 0 && currentHeight + needed > PAGE_CONTENT_HEIGHT) {
      // Start new page
      pages.push(currentPage)
      currentPage = [section]
      currentHeight = sectionH
    } else {
      currentPage.push(section)
      currentHeight += needed
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage)
  }

  return pages
}

export function ReportPreviewArea({
  sections,
  projectName,
  resultSetName,
  isLoading,
}: ReportPreviewAreaProps) {
  const pages = useMemo(() => paginateSections(sections), [sections])

  if (isLoading) {
    return (
      <div className="report-preview-area flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading preview...</div>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="report-preview-area flex items-center justify-center">
        <div className="text-text-muted text-sm">Select sections from the tree to preview</div>
      </div>
    )
  }

  return (
    <div className="report-preview-area">
      {pages.map((pageSections, i) => (
        <ReportPage
          key={i}
          sections={pageSections}
          projectName={projectName}
          resultSetName={resultSetName}
          pageNumber={i + 1}
        />
      ))}
    </div>
  )
}
