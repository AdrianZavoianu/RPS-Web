import clsx from 'clsx'
import { NavLink } from 'react-router-dom'

interface ProjectBrowserNavProps {
  projectSlug: string
  className?: string
}

export function ProjectBrowserNav({ projectSlug, className }: ProjectBrowserNavProps) {
  const basePath = `/projects/${projectSlug}`
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx('project-browser-link', isActive && 'project-browser-link-active')

  return (
    <nav
      className={clsx('project-browser border-b border-border-default px-2 py-2', className)}
      aria-label="Project browser"
    >
      <div className="project-browser-title">Results</div>
      <div className="project-browser-section">
        <div className="project-browser-section-title">NLTHA</div>
        <NavLink to={`${basePath}/results`} end className={linkClass}>
          Results
        </NavLink>
        <NavLink to={`${basePath}/maxmin`} className={linkClass}>
          Max/Min
        </NavLink>
        <NavLink to={`${basePath}/comparison`} className={linkClass}>
          Comparison
        </NavLink>
        <NavLink to={`${basePath}/elements`} className={linkClass}>
          Elements
        </NavLink>
        <NavLink to={`${basePath}/foundation`} className={linkClass}>
          Foundation
        </NavLink>
        <NavLink to={`${basePath}/time-series`} className={linkClass}>
          Time Series
        </NavLink>
      </div>
      <div className="project-browser-section">
        <div className="project-browser-section-title">Pushover</div>
        <NavLink to={`${basePath}/pushover`} className={linkClass}>
          Pushover
        </NavLink>
      </div>
    </nav>
  )
}
