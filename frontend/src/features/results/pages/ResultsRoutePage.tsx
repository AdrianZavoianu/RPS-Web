import { ResultsView } from '../../../components/results/ResultsView'

interface ResultsRoutePageProps {
  projectSlug: string
}

export function ResultsRoutePage({ projectSlug }: ResultsRoutePageProps) {
  return <ResultsView projectSlug={projectSlug} />
}
