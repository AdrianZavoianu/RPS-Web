import { MaxMinView } from '../../../components/results/MaxMinView'

interface MaxMinRoutePageProps {
  projectSlug: string
}

export function MaxMinRoutePage({ projectSlug }: MaxMinRoutePageProps) {
  return <MaxMinView projectSlug={projectSlug} />
}
