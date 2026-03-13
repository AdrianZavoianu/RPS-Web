import { afterEach, describe, expect, it, vi } from 'vitest'
import * as reportsApi from '../../src/api/reports'
import { apiClient } from '../../src/api/client'

function makeReportJob(overrides: Partial<reportsApi.ReportJob> = {}): reportsApi.ReportJob {
  return {
    id: 1,
    status: 'pending',
    progress: 0,
    file_name: 'report.pdf',
    download_url: null,
    error_message: null,
    created_at: '2025-01-01T00:00:00Z',
    completed_at: null,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('reports api', () => {
  it('getReportJobs requests the report jobs collection', async () => {
    const jobs = [makeReportJob({ id: 1 }), makeReportJob({ id: 2 })]
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue(jobs as never)

    const result = await reportsApi.getReportJobs('project-a')

    expect(getSpy).toHaveBeenCalledWith('/projects/project-a/reports/jobs/')
    expect(result).toEqual(jobs)
  })

  it('getReportJob requests a single report job', async () => {
    const job = makeReportJob({ id: 42, status: 'processing', progress: 60 })
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue(job as never)

    const result = await reportsApi.getReportJob('project-a', 42)

    expect(getSpy).toHaveBeenCalledWith('/projects/project-a/reports/jobs/42/')
    expect(result).toEqual(job)
  })

  it('startReportJob posts request payload to create a report job', async () => {
    const request: reportsApi.ReportJobRequest = {
      result_set_id: 3,
      sections: [{ result_type: 'Drifts', direction: 'X' }],
      project_name: 'Tower One',
    }
    const created = makeReportJob({ id: 9 })
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(created as never)

    const result = await reportsApi.startReportJob('project-a', request)

    expect(postSpy).toHaveBeenCalledWith('/projects/project-a/reports/jobs/', request)
    expect(result).toEqual(created)
  })

  it('cancelReportJob deletes an existing report job', async () => {
    const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValue(undefined as never)

    await reportsApi.cancelReportJob('project-a', 7)

    expect(deleteSpy).toHaveBeenCalledWith('/projects/project-a/reports/jobs/7/')
  })

  it('downloadReportFile fetches report blob from download endpoint', async () => {
    const blob = new Blob(['pdf-bytes'], { type: 'application/pdf' })
    const getBlobSpy = vi.spyOn(apiClient, 'getBlob').mockResolvedValue(blob)

    const result = await reportsApi.downloadReportFile('project-a', 7)

    expect(getBlobSpy).toHaveBeenCalledWith('/projects/project-a/reports/jobs/7/download/')
    expect(result).toBe(blob)
  })

  it('getReportPreview fetches section preview for a result set', async () => {
    const preview: reportsApi.ReportPreview = {
      result_set: {
        id: 4,
        name: 'Run 4',
        analysis_type: 'NLTHA',
      },
      available_sections: [
        {
          result_type: 'Drifts',
          direction: 'X',
          category: 'Envelopes',
          label: 'Drifts X',
        },
      ],
    }
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue(preview as never)

    const result = await reportsApi.getReportPreview('project-a', 4)

    expect(getSpy).toHaveBeenCalledWith('/projects/project-a/reports/preview/?result_set_id=4')
    expect(result).toEqual(preview)
  })

  it('generateReport posts payload and returns a blob', async () => {
    const request: reportsApi.GenerateReportRequest = {
      result_set_id: 8,
      sections: [{ result_type: 'Forces', direction: 'Y' }],
    }
    const blob = new Blob(['pdf'])
    const postBlobSpy = vi.spyOn(apiClient, 'postBlob').mockResolvedValue(blob)

    const result = await reportsApi.generateReport('project-a', request)

    expect(postBlobSpy).toHaveBeenCalledWith('/projects/project-a/reports/generate/', request)
    expect(result).toBe(blob)
  })

  it('getReportSectionData posts section selection and returns structured data', async () => {
    const request: reportsApi.SectionDataRequest = {
      result_set_id: 12,
      sections: [{ result_type: 'Drifts', direction: 'X' }],
      project_name: 'Tower Two',
    }

    const sectionData: reportsApi.SectionDataResponse = {
      project_name: 'Tower Two',
      result_set_name: 'Run 12',
      sections: [
        {
          title: 'Drifts X',
          result_type: 'Drifts',
          direction: 'X',
          category: 'Envelopes',
          unit: '%',
          table: {
            label_headers: ['Story'],
            columns: ['LC1'],
            rows: [{ label_columns: ['L1'], values: ['0.1'] }],
          },
          chart_svg: null,
        },
      ],
    }

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(sectionData as never)

    const result = await reportsApi.getReportSectionData('project-a', request)

    expect(postSpy).toHaveBeenCalledWith('/projects/project-a/reports/sections/', request)
    expect(result).toEqual(sectionData)
  })

  it('downloadBlob creates a temporary anchor, clicks it, and cleans up', () => {
    const createObjectURL = vi.fn(() => 'blob:report-file')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal(
      'URL',
      {
        createObjectURL,
        revokeObjectURL,
      } as unknown as typeof URL
    )

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    const blob = new Blob(['pdf-bytes'], { type: 'application/pdf' })
    reportsApi.downloadBlob(blob, 'report.pdf')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report-file')
    expect(document.body.querySelector('a[download="report.pdf"]')).toBeNull()
  })
})
