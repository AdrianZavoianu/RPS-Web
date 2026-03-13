import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { makeProject, makeResultSet, makeImportJob } from './factories'

export const handlers = [
  http.get('/api/projects/:slug/', ({ params }) => {
    return HttpResponse.json(makeProject({ slug: params.slug as string }))
  }),

  http.get('/api/projects/:slug/result-sets/', () => {
    return HttpResponse.json([
      makeResultSet({ id: 1, name: 'NLTHA Run 1' }),
      makeResultSet({ id: 2, name: 'NLTHA Run 2' }),
    ])
  }),

  http.get('/api/projects/:slug/imports/', () => {
    return HttpResponse.json([makeImportJob()])
  }),

  http.get('/api/projects/:slug/imports/:jobId/', ({ params }) => {
    return HttpResponse.json(makeImportJob({ id: Number(params.jobId) }))
  }),

  http.post('/api/auth/refresh/', () => {
    return HttpResponse.json({ access: 'new-access-token', refresh: 'new-refresh-token' })
  }),
]

export const server = setupServer(...handlers)
