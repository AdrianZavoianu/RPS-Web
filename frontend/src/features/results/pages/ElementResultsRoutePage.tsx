import { ElementResultsView } from '../../../components/results/ElementResultsView'

interface ElementResultsRoutePageProps {
  projectSlug: string
}

export function ElementResultsRoutePage({ projectSlug }: ElementResultsRoutePageProps) {
  return <ElementResultsView projectSlug={projectSlug} />
}
