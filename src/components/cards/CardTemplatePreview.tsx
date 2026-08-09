import type { BingoRuleSet, CardTemplate } from '@/types/database'
import { layoutsForFormat } from '@/domain/cards/layouts'

type Props = {
  format: 1 | 2 | 3
  layoutKey: string
  bannerPosition: 'top' | 'bottom' | 'none'
  eventName?: string
  orientation?: 'portrait' | 'landscape'
  showQrCode?: boolean
  showEventName?: boolean
  showSeries?: boolean
  seriesCode?: string
  sequenceNumber?: number
  codePadding?: number
  rule?: BingoRuleSet | null
}

export function CardTemplatePreview({
  format,
  layoutKey,
  bannerPosition,
  eventName = 'Seu evento',
  orientation = 'portrait',
  showQrCode = true,
  showEventName = true,
  showSeries = true,
  seriesCode = 'A',
  sequenceNumber = 1,
  codePadding = 5,
  rule,
}: Props) {
  const preset = layoutsForFormat(format).find((item) => item.key === layoutKey)
  const cardCode = `${seriesCode || 'A'}-${String(Math.max(1, sequenceNumber)).padStart(Math.max(1, codePadding), '0')}`
  const banner = bannerPosition === 'none' ? null : (
    <div className="grid min-h-16 place-items-center overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-r from-red-950 via-slate-950 to-red-950 px-3 text-center">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[.22em] text-red-400">BINGOUP</p>
        {showEventName && <p className="mt-1 text-sm font-black text-white">{eventName}</p>}
      </div>
    </div>
  )
  const games = Array.from({ length: format }, (_, index) => <MiniGame key={index} index={index + 1} rule={rule} />)
  const horizontal = layoutKey.includes('horizontal')
  const gridClass = horizontal ? (format === 2 ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2 sm:grid-cols-3') : 'grid gap-2'
  const oneTwo = layoutKey === 'triple_one_two'
  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-950/65 p-3">
      <div className={`mx-auto rounded-2xl border border-slate-300 bg-white p-3 text-slate-950 shadow-2xl ${orientation === 'landscape' ? 'max-w-3xl' : 'max-w-xl'}`}>
        {bannerPosition === 'top' && banner}
        <div className={`my-3 ${oneTwo ? 'grid grid-cols-2 gap-2' : gridClass}`}>
          {oneTwo ? <><div className="col-span-2">{games[0]}</div>{games.slice(1)}</> : games}
        </div>
        {bannerPosition === 'bottom' && banner}
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-[10px] font-bold text-slate-600">
          <span>{cardCode}{showSeries ? ` · Série ${seriesCode || 'A'}` : ''}</span>
          {showQrCode && <span className="grid h-9 w-9 place-items-center rounded border border-slate-300 bg-slate-50 text-[8px] font-black">QR</span>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-slate-400">
        <span>{preset?.name ?? layoutKey}</span><span>•</span><span>{format} em 1</span><span>•</span><span>{orientation === 'landscape' ? 'Horizontal' : 'Vertical'}</span>
      </div>
    </div>
  )
}

function MiniGame({ index, rule }: { index: number; rule?: BingoRuleSet | null }) {
  const rows = rule?.grid_rows ?? 5
  const cols = rule?.grid_columns ?? 5
  const labels = rule?.column_definitions?.length === cols ? rule.column_definitions.map((column) => column.label) : ['B', 'I', 'N', 'G', 'O'].slice(0, cols)
  const cells = buildPreviewCells(rule, rows, cols)
  return (
    <div className="rounded-xl border border-slate-300 p-2">
      <div className="mb-1 text-center text-[9px] font-black tracking-wide text-slate-500">JOGO {index}</div>
      <div className="grid gap-1 text-center text-[9px] font-bold" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {labels.map((label) => <b key={label} className="rounded bg-slate-900 py-1 text-white">{label}</b>)}
        {cells.map((value, cellIndex) => <span key={cellIndex} className="grid min-h-6 place-items-center rounded border border-slate-200 bg-slate-50 py-1">{value === null ? '★' : String(value).padStart(2, '0')}</span>)}
      </div>
    </div>
  )
}

function buildPreviewCells(rule: BingoRuleSet | null | undefined, rows: number, cols: number): Array<number | null> {
  const total = rows * cols
  const center = rule?.free_center ? Math.floor(total / 2) : -1
  const result: Array<number | null> = []
  for (let index = 0; index < total; index += 1) {
    if (index === center) { result.push(null); continue }
    const columnIndex = index % cols
    const rowIndex = Math.floor(index / cols)
    const definition = rule?.column_definitions?.[columnIndex]
    if (definition) {
      const span = Math.max(1, definition.max - definition.min + 1)
      result.push(definition.min + ((rowIndex * 3 + columnIndex) % span))
    } else {
      result.push(((index * 7) % Math.max(1, rule?.total_balls ?? 75)) + 1)
    }
  }
  return result
}

export function previewPropsFromTemplate(template: CardTemplate | undefined) {
  if (!template) return {}
  return {
    orientation: template.orientation,
    showQrCode: template.show_qr_code,
    showEventName: template.show_event_name,
    showSeries: template.show_series,
  }
}
