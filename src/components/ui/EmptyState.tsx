export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><h2 className="font-semibold">{title}</h2>{description && <p className="mt-2 text-sm text-slate-600">{description}</p>}</div>
}
