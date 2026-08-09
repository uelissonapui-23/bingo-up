import { forwardRef, type InputHTMLAttributes } from 'react'
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input ref={ref} {...props} className={`min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:ring-2 focus:ring-slate-900 ${props.className ?? ''}`} />
})
