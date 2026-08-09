import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
export function NotFoundPage(){return <main className="grid min-h-dvh place-items-center bg-slate-50 p-6"><div className="max-w-md text-center"><p className="text-sm font-bold text-slate-500">404</p><h1 className="mt-2 text-3xl font-black">Página não encontrada</h1><p className="mt-3 text-slate-600">O endereço pode estar incorreto ou o conteúdo não está mais disponível.</p><Link to="/"><Button className="mt-6">Voltar ao início</Button></Link></div></main>}
