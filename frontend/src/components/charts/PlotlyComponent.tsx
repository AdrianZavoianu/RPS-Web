import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js/lib/core'
import scatter from 'plotly.js/lib/scatter'
import bar from 'plotly.js/lib/bar'

Plotly.register([scatter, bar])

const Plot = createPlotlyComponent(Plotly)

export default Plot
