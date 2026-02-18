import { JointResultsView } from '../../../components/results/JointResultsView'

interface FoundationResultsRoutePageProps {
  projectSlug: string
}

export function FoundationResultsRoutePage({ projectSlug }: FoundationResultsRoutePageProps) {
  return <JointResultsView projectSlug={projectSlug} />
}
