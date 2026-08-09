import { forwardRef, type TextareaHTMLAttributes } from 'react'
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  return <textarea ref={ref} {...props} className={`min-h-28 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:ring-2 focus:ring-slate-900 ${props.className ?? ''}`} />
})
