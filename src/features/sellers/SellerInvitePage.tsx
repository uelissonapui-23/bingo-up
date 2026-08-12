import {useEffect,useState} from 'react'
import {useNavigate,useParams} from 'react-router-dom'
import {useAuth} from '@/app/providers/AuthProvider'
import {useWorkspace} from '@/app/providers/WorkspaceProvider'
import {Button} from '@/components/ui/Button'
import {Card} from '@/components/ui/Card'
import {usePlatformBrand} from '@/components/brand/PlatformBrandProvider'
import {acceptSellerInvitation,getSellerInvitation,type SellerInviteInfo} from './sellerService'

export function SellerInvitePage(){const {mainLogoUrl,app_name}=usePlatformBrand();const {token=''}=useParams();const {user}=useAuth();const {refresh}=useWorkspace();const navigate=useNavigate();const [info,setInfo]=useState<SellerInviteInfo|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false)
useEffect(()=>{void getSellerInvitation(token).then(setInfo).catch((e:any)=>setError(e?.message||'Convite inválido.')).finally(()=>setLoading(false))},[token])
async function accept(){setBusy(true);setError(null);try{await acceptSellerInvitation(token);await refresh();navigate('/venda',{replace:true})}catch(e:any){setError(e?.message||'Não foi possível aceitar o convite.')}finally{setBusy(false)}}
return <main className="bingoup-app grid min-h-dvh place-items-center p-4"><Card className="w-full max-w-xl"><img className="h-12" src={mainLogoUrl} alt={app_name}/><h1 className="mt-5 text-2xl font-black text-white">Convite para vendedor</h1>{loading?<p className="mt-4 text-sm text-slate-400">Carregando convite…</p>:error?<p className="mt-4 rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>:info?<><p className="mt-3 text-slate-300">Você foi convidado para vender cartelas em <strong className="text-white">{info.workspace_name}</strong>.</p><div className="mt-4 rounded-xl border border-slate-700 p-4 text-sm text-slate-300"><p>Conta: <strong>{user?.email}</strong></p><p className="mt-1">Convite: <strong>{info.email}</strong></p><p className="mt-1">Eventos: {info.event_names.length?info.event_names.join(', '):'nenhum evento atribuído ainda'}</p></div>{info.status==='pending'?<Button className="mt-5 w-full" disabled={busy} onClick={()=>void accept()}>{busy?'Aceitando…':'Aceitar convite'}</Button>:<p className="mt-4 text-sm text-amber-300">Este convite está {info.status==='accepted'?'já utilizado':'indisponível'}.</p>}</>:null}</Card></main>}
