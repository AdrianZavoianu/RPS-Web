import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/handlers'
import * as reportsApi from '../../src/api/reports'
import {
  useCancelReportJob,
  useGenerateReport,
  useReportJob,
  useReportJobs,
  useReportPreview,
  useReportSectionData,
  useStartReportJob,
} from '../../src/hooks/useReports'

vi.mock('../../src/hooks/useJobProgressTransport', () => ({
  useJobProgressTransport: vi.fn(() => false),
}))

vi.mock('../../src/stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: { token: string }) => unknown) => selector({ token: 'test-token' }),
    { getState: () => ({ token: 'test-token', refreshToken: null, logout: vi.fn() }) }
  ),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}

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

describe('useReportJobs', () => {
  it('fetches report jobs for a project', async () => {
    const jobs = [makeReportJob({ id: 1 }), makeReportJob({ id: 2 })]
    server.use(http.get('/api/projects/:slug/reports/jobs/', () => HttpResponse.json(jobs)))

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReportJobs('test-project'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('does not fetch when slug is empty', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReportJobs(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useReportJob', () => {
  it('fetches a single report job', async () => {
    const job = makeReportJob({ id: 3, status: 'processing', progress: 45 })
    server.use(http.get('/api/projects/:slug/reports/jobs/:jobId/', () => HttpResponse.json(job)))

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReportJob('test-project', 3), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe(3)
    expect(result.current.data?.progress).toBe(45)
  })

  it('does not fetch when jobId is null', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReportJob('test-project', null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useStartReportJob', () => {
  it('starts report job and invalidates report jobs list', async () => {
    const job = makeReportJob({ id: 10, status: 'pending' })
    server.use(http.post('/api/projects/:slug/reports/jobs/', () => HttpResponse.json(job)))

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useStartReportJob('test-project'), { wrapper })

    await act(async () => {
      const created = await result.current.mutateAsync({
        result_set_id: 1,
        sections: [{ result_type: 'Drifts', direction: 'X' }],
      })
      expect(created.id).toBe(10)
    })

    expect(invalidateSpy).toHaveBeenCalled()
  })
})

describe('useCancelReportJob', () => {
  it('cancels report job and invalidates report queries', async () => {
    server.use(
      http.delete('/api/projects/:slug/reports/jobs/:jobId/', () => new HttpResponse(null, { status: 204 }))
    )

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCancelReportJob('test-project'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(1)
    })

    expect(invalidateSpy).toHaveBeenCalled()
  })
})

describe('useReportPreview', () => {
  it('fetches available report sections for a result set', async () => {
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

    server.use(http.get('/api/projects/:slug/reports/preview/', () => HttpResponse.json(preview)))

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReportPreview('test-project', 4), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.available_sections).toHaveLength(1)
    expect(result.current.data?.result_set.id).toBe(4)
  })

  it('does not fetch preview when resultSetId is null', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReportPreview('test-project', null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useGenerateReport', () => {
  it('downloads PDF blob after successful generation', async () => {
    const blob = new Blob(['pdf-content'], { type: 'application/pdf' })
    const generateSpy = vi.spyOn(reportsApi, 'generateReport').mockResolvedValue(blob)
    const downloadSpy = vi.spyOn(reportsApi, 'downloadBlob').mockImplementation(() => undefined)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useGenerateReport('test-project'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        result_set_id: 77,
        sections: [{ result_type: 'Drifts', direction: 'X' }],
      })
    })

    expect(generateSpy).toHaveBeenCalledWith('test-project', {
      result_set_id: 77,
      sections: [{ result_type: 'Drifts', direction: 'X' }],
    })
    expect(downloadSpy).toHaveBeenCalledWith(blob, 'report_77.pdf')
  })
})

describe('useReportSectionData', () => {
  it('requests structured section data through mutation', async () => {
    const response: reportsApi.SectionDataResponse = {
      project_name: 'Tower',
      result_set_name: 'Run 1',
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
            rows: [{ label_columns: ['L1'], values: ['0.12'] }],
          },
          chart_svg: null,
        },
      ],
    }

    const sectionDataSpy = vi.spyOn(reportsApi, 'getReportSectionData').mockResolvedValue(response)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReportSectionData('test-project'), { wrapper })

    await act(async () => {
      const data = await result.current.mutateAsync({
        result_set_id: 1,
        sections: [{ result_type: 'Drifts', direction: 'X' }],
      })
      expect(data.sections).toHaveLength(1)
    })

    expect(sectionDataSpy).toHaveBeenCalledWith('test-project', {
      result_set_id: 1,
      sections: [{ result_type: 'Drifts', direction: 'X' }],
    })
  })
})
