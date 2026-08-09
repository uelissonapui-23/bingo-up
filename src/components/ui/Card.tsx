import type { HTMLAttributes, PropsWithChildren } from 'react'
import { clsx } from 'clsx'

export function Card({ className, children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={clsx('rounded-3xl border border-slate-200 bg-white p-5 shadow-sm', className)} {...props}>{children}</div>
}
