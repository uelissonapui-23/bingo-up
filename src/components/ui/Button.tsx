import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { clsx } from 'clsx'

type Props = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: 'primary' | 'secondary' | 'danger'
}

export function Button({ variant = 'primary', className, children, ...props }: Props) {
  return (
    <button
      className={clsx(
        'inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-slate-900 text-white hover:bg-slate-800',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-500',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
