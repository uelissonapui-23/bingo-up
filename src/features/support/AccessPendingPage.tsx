import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { usePlatformBrand } from '@/components/brand/PlatformBrandProvider'
import { Button } from '@/components/ui/Button'
import {
  createSupportAttachmentUrl, getMySupportConversation, getOrCreateSupportThread, sendMySupportMessage,
  uploadSupportAttachment, type PlatformAccessState, type SupportConversation,
} from './supportService'

export function AccessPendingPage({ access, onRefresh }: { access: PlatformAccessState; onRefresh: () => Promise<void> }) {
  const { user, signOut } = useAuth(); const { mainLogoUrl, app_name } = usePlatformBrand()
  const [conversation, setConversation] = useState<SupportConversation>({ thread_id: null, status: null, messages: [] })
  const [message, setMessage] = useState(''); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null)
  const whatsapp = useMemo(() => (access.whatsapp_number ?? '').replace(/\D/g, ''), [access.whatsapp_number])
  const whatsappHref = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Preciso de ajuda para liberar meu acesso ao ${app_name}. Meu e-mail é ${user?.email ?? ''}.`)}` : null

  const loadConversation = useCallback(async () => {
    if (!access.support_enabled) return
    try { setConversation(await getMySupportConversation()) } catch { /* suporte não pode derrubar a tela de bloqueio */ }
  }, [access.support_enabled])
  useEffect(() => {
    void loadConversation()
    if (!access.support_enabled) return
    const id=window.setInterval(()=>void loadConversation(),10000)
    return()=>window.clearInterval(id)
  }, [access.support_enabled, loadConversation])

  async function send() {
    if ((!message.trim() && !file) || !user) return
    setBusy(true); setError(null); setNotice(null)
    try {
      const threadId = conversation.thread_id ?? await getOrCreateSupportThread()
      let attachmentPath: string | null = null
      if (file) attachmentPath = await uploadSupportAttachment(user.id, threadId, file)
      await sendMySupportMessage({ body: message, attachmentPath, attachmentName: file?.name ?? null })
      setMessage(''); setFile(null); setNotice('Mensagem enviada para o suporte.'); await loadConversation()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar a mensagem.') }
    finally { setBusy(false) }
  }

  return <main className="bingoup-app min-h-dvh bg-slate-950 px-4 py-8 text-slate-100"><div className="mx-auto max-w-3xl space-y-4">
    <div className="flex items-center justify-between gap-3"><img src={mainLogoUrl} alt={app_name} className="max-h-14 max-w-[220px] object-contain"/><Button variant="secondary" onClick={() => void signOut()}>Sair</Button></div>
    <section className="rounded-3xl border border-amber-700/40 bg-slate-900 p-6 shadow-2xl"><span className="rounded-full bg-amber-950 px-3 py-1 text-xs font-black uppercase text-amber-300">Acesso aguardando liberação</span><h1 className="mt-4 text-2xl font-black text-white md:text-3xl">{access.blocked_title}</h1><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-300">{access.blocked_message}</p><div className="mt-5 flex flex-col gap-2 sm:flex-row">{whatsappHref&&<a className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500" href={whatsappHref} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>}<Button variant="secondary" onClick={() => void onRefresh()}>Verificar liberação</Button></div>{!whatsappHref&&<p className="mt-3 text-xs text-amber-300">O WhatsApp de atendimento ainda não foi configurado. Use o suporte abaixo.</p>}</section>
    {access.support_enabled&&<section className="rounded-3xl border border-slate-800 bg-slate-900 p-5"><div><h2 className="text-xl font-black text-white">Suporte</h2><p className="text-sm text-slate-400">Converse com a equipe responsável sem sair do BINGOUP. Você também pode enviar um comprovante.</p></div><div className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/50 p-3">{conversation.messages.length===0?<p className="py-6 text-center text-sm text-slate-500">Envie sua primeira mensagem para o suporte.</p>:conversation.messages.map(m=><SupportBubble key={m.id} message={m} />)}</div><textarea className="mt-3 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-red-500" maxLength={2000} placeholder="Digite sua mensagem…" value={message} onChange={e=>setMessage(e.target.value)}/><div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><label className="cursor-pointer rounded-xl border border-dashed border-slate-700 px-3 py-2 text-xs font-bold text-slate-300"><span>{file ? file.name : 'Anexar comprovante (PNG, JPG, WebP ou PDF)'}</span><input className="hidden" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e:ChangeEvent<HTMLInputElement>)=>setFile(e.target.files?.[0]??null)}/></label><Button disabled={busy||(!message.trim()&&!file)} onClick={()=>void send()}>{busy?'Enviando…':'Enviar para suporte'}</Button></div>{notice&&<p className="mt-2 text-sm text-emerald-300">{notice}</p>}{error&&<p className="mt-2 text-sm text-red-300">{error}</p>}</section>}
  </div></main>
}

function SupportBubble({ message }: { message: SupportConversation['messages'][number] }) {
  const mine = message.sender_kind === 'user'; const [opening,setOpening]=useState(false)
  async function openAttachment(){if(!message.attachment_path)return;setOpening(true);try{window.open(await createSupportAttachmentUrl(message.attachment_path),'_blank','noopener,noreferrer')}finally{setOpening(false)}}
  return <div className={`flex ${mine?'justify-end':'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine?'bg-red-700 text-white':'bg-slate-800 text-slate-100'}`}>{message.body&&<p className="whitespace-pre-wrap">{message.body}</p>}{message.attachment_path&&<button className="mt-1 block text-xs font-black underline" onClick={()=>void openAttachment()} disabled={opening}>{opening?'Abrindo…':`📎 ${message.attachment_name??'Anexo'}`}</button>}<p className="mt-1 text-[10px] opacity-60">{message.sender_kind==='master'?'Suporte':'Você'} · {new Date(message.created_at).toLocaleString('pt-BR')}</p></div></div>
}
