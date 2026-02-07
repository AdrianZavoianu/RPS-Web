import { ProjectBrowserNav } from './ProjectBrowserNav'

interface ProjectSettingsProps {
  projectSlug: string
}

export function ProjectSettings({ projectSlug }: ProjectSettingsProps) {
  return (
    <div className="h-full flex">
      <div className="w-[220px] bg-bg-secondary border-r border-border-default flex flex-col overflow-auto">
        <ProjectBrowserNav projectSlug={projectSlug} />
        <div className="browser-section">
          <h3 className="browser-section-title">Settings</h3>
          <p className="text-xs text-text-muted">
            Configure project metadata and preferences.
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-6">Project Settings</h3>
        <div className="max-w-2xl space-y-6">
          <div className="card bg-bg-secondary border border-border-default rounded-lg p-6">
            <h4 className="font-medium text-text-primary mb-4">General Information</h4>
            <p className="text-text-secondary text-sm">
              Project settings will be available here
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
