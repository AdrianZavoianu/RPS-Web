import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCreateProject, useDeleteProject, useProjects } from '../hooks/useProjects'
import { ConfirmDialog, AlertDialog } from '../components/common/ConfirmDialog'
import { getApiErrorMessage } from '../types/errors'
import type { Project } from '../types'

let projectWorkspacePrefetchStarted = false

function prefetchProjectWorkspace(): void {
  if (projectWorkspacePrefetchStarted) {
    return
  }
  projectWorkspacePrefetchStarted = true
  void Promise.all([
    import('./ProjectDetailPage'),
    import('../components/results/ResultsView'),
    import('../components/projects/ProjectBrowserNav'),
  ])
}

export function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ slug: string; name: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    description: string
  }>({
    name: '',
    description: '',
  })
  const navigate = useNavigate()
  const { data: projects = [], isLoading, error } = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()

  const filteredProjects = projects.filter(
    (project) => {
      const query = searchQuery.toLowerCase()
      return (
        project.name.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
      )
    }
  )

  const openCreateDialog = () => {
    setCreateError(null)
    setIsCreateOpen(true)
  }

  const closeCreateDialog = () => {
    setIsCreateOpen(false)
    setCreateError(null)
    setFormData({ name: '', description: '' })
  }

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreateError(null)

    const name = formData.name.trim()
    if (!name) {
      setCreateError('Project name is required')
      return
    }

    try {
      const project = await createProject.mutateAsync({
        name,
        description: formData.description.trim() || undefined,
      })
      closeCreateDialog()
      if (project.slug) {
        navigate(`/projects/${project.slug}`)
      } else {
        setCreateError('Project created, but slug is missing. Refresh the list.')
      }
    } catch (err) {
      setCreateError(getApiErrorMessage(err, 'Failed to create project'))
    }
  }

  const handleDeleteProject = (slug: string, name: string) => {
    setDeleteConfirm({ slug, name })
  }

  const confirmDeleteProject = async () => {
    if (!deleteConfirm) return

    try {
      await deleteProject.mutateAsync(deleteConfirm.slug)
      setDeleteConfirm(null)
    } catch (err) {
      setDeleteConfirm(null)
      setDeleteError(getApiErrorMessage(err, 'Failed to delete project'))
    }
  }

  const handleProjectOpenIntent = () => {
    prefetchProjectWorkspace()
  }

  return (
    <div className="h-full overflow-auto px-6 pb-6 pt-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="page-headline">My Projects</h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={openCreateDialog}>
            Create New Project
          </button>
          <button
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled
            title="Coming soon"
          >
            Import Project
          </button>
        </div>
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-64"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-text-secondary">Loading projects...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-red-400">Failed to load projects</div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="text-text-secondary mb-4">
            {searchQuery ? 'No projects match your search' : 'No projects yet'}
          </div>
          {!searchQuery && (
            <button className="btn-primary" onClick={openCreateDialog}>
              Create Your First Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={() => handleDeleteProject(project.slug, project.name)}
              onOpenIntent={handleProjectOpenIntent}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Project"
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={confirmDeleteProject}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Delete Error Alert */}
      {deleteError && (
        <AlertDialog
          title="Delete Failed"
          message={deleteError}
          variant="error"
          onClose={() => setDeleteError(null)}
        />
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-border-default bg-bg-secondary p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[24px] font-semibold text-text-primary">Create New Project</h3>
              <button
                onClick={closeCreateDialog}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              {createError && (
                <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded text-sm">
                  {createError}
                </div>
              )}
              <div>
                <label htmlFor="project-name" className="block text-sm text-text-secondary mb-1">
                  Project Name
                </label>
                <input
                  id="project-name"
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label htmlFor="project-description" className="block text-sm text-text-secondary mb-1">
                  Description
                </label>
                <textarea
                  id="project-description"
                  className="input min-h-[96px] resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeCreateDialog}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createProject.isPending}
                >
                  {createProject.isPending ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({
  project,
  onDelete,
  onOpenIntent,
}: {
  project: Project
  onDelete: () => void
  onOpenIntent: () => void
}) {
  const createdAt = project.created_at
    ? new Date(project.created_at).toLocaleDateString()
    : '—'
  const loadCases = project.load_case_count ?? 0
  const stories = project.story_count ?? 0

  return (
    <div className="project-card flex flex-col min-h-[220px]">
      <div className="flex flex-col h-full">
        <div>
          <h3 className="project-card-title mb-2">{project.name}</h3>
          {project.description && <p className="project-card-body">{project.description}</p>}
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="project-stat-label">Load cases</span>
            <span className="project-stat-value">{loadCases}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="project-stat-label">Stories</span>
            <span className="project-stat-value">{stories}</span>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <div className="project-card-divider" />
          <div className="flex items-center justify-between pt-3">
            <span className="project-card-footer-label">Created</span>
            <span className="project-card-footer-value">{createdAt}</span>
          </div>
          <div className="flex items-center justify-between pt-4">
            <Link
              to={`/projects/${project.slug}`}
              className="project-card-action"
              onMouseEnter={onOpenIntent}
              onFocus={onOpenIntent}
            >
              Open
            </Link>
            <button
              type="button"
              className="project-card-delete h-8 w-8"
              aria-label={`Delete ${project.name}`}
              onClick={onDelete}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8M6 6l1 14h10l1-14"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
