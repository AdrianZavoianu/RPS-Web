/**
 * Chart Legend component matching desktop style - horizontal below plot
 */
export function ChartLegend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="chart-legend flex flex-wrap justify-center gap-x-5 gap-y-1.5 px-3 py-2.5">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span
            className="inline-block w-5 h-[3px] rounded-sm shrink-0"
            style={{
              background: item.dashed
                ? `repeating-linear-gradient(90deg, ${item.color} 0px, ${item.color} 5px, transparent 5px, transparent 9px)`
                : item.color,
            }}
          />
          <span className="text-text-primary font-medium" style={{ fontSize: '13px' }}>{item.name}</span>
        </div>
      ))}
    </div>
  )
}
