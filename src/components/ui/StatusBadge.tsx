import { clsx } from 'clsx'

type Props = { children: string; tone?: 'success' | 'warning' | 'neutral' | 'danger' | 'info' }

export function StatusBadge({ children, tone = 'neutral' }: Props) {
  return (
    <span className={clsx(
      'inline-flex max-w-full shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-semibold leading-snug whitespace-normal',
      tone === 'success' && 'bg-emerald-50 text-emerald-700',
      tone === 'warning' && 'bg-amber-50 text-amber-700',
      tone === 'neutral' && 'bg-slate-100 text-slate-600',
      tone === 'danger' && 'bg-red-50 text-red-700',
      tone === 'info' && 'bg-sky-50 text-sky-700',
    )}>
      {children}
    </span>
  )
}
