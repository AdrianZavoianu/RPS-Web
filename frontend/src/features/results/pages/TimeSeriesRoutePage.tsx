import { TimeSeriesView } from '../../../components/results/TimeSeriesView'

interface TimeSeriesRoutePageProps {
  projectSlug: string
}

export function TimeSeriesRoutePage({ projectSlug }: TimeSeriesRoutePageProps) {
  return <TimeSeriesView projectSlug={projectSlug} />
}
