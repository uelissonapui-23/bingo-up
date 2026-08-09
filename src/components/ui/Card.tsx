import type { HTMLAttributes, PropsWithChildren } from 'react'
import { clsx } from 'clsx'
export function Card({ className, children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {return <div className={clsx('rounded-2xl border border-slate-700/70 bg-slate-900/65 p-5 shadow-[0_14px_45px_rgba(0,0,0,.16)]', className)} {...props}>{children}</div>}
