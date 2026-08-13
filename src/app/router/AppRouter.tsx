import {lazy,Suspense} from 'react'
import {Route,Routes} from 'react-router-dom'
import {RequireAuth} from '@/app/guards/RequireAuth'
import {RequireWorkspace} from '@/app/guards/RequireWorkspace'
import {RequirePlatformOwner} from '@/app/guards/RequirePlatformOwner'
import {RequirePlatformAccess} from '@/app/guards/RequirePlatformAccess'
import {RequireEventAccess} from '@/app/guards/RequireEventAccess'
import {AppShell} from '@/components/layout/AppShell'
import {LoginPage} from '@/features/auth/LoginPage'
import {RegisterPage} from '@/features/auth/RegisterPage'
import {ForgotPasswordPage} from '@/features/auth/ForgotPasswordPage'
import {ResetPasswordPage} from '@/features/auth/ResetPasswordPage'
import {ConfirmEmailPage} from '@/features/auth/ConfirmEmailPage'
import {WorkspaceOnboardingPage} from '@/features/workspace/WorkspaceOnboardingPage'

const RoleHomePage=lazy(()=>import('@/features/dashboard/RoleHomePage').then(m=>({default:m.RoleHomePage})))
const AccountPage=lazy(()=>import('@/features/account/AccountPage').then(m=>({default:m.AccountPage})))
const PublicPanelPage=lazy(()=>import('@/features/public-panel/PublicPanelPage').then(m=>({default:m.PublicPanelPage})))
const EventsPage=lazy(()=>import('@/features/events/EventsPage').then(m=>({default:m.EventsPage})))
const NewEventPage=lazy(()=>import('@/features/events/NewEventPage').then(m=>({default:m.NewEventPage})))
const EventDetailPage=lazy(()=>import('@/features/events/EventDetailPage').then(m=>({default:m.EventDetailPage})))
const EditEventPage=lazy(()=>import('@/features/events/EditEventPage').then(m=>({default:m.EditEventPage})))
const CardConfigurationPage=lazy(()=>import('@/features/card-config/CardConfigurationPage').then(m=>({default:m.CardConfigurationPage})))
const CardGeneratorPage=lazy(()=>import('@/features/card-generator/CardGeneratorPage').then(m=>({default:m.CardGeneratorPage})))
const CardsPage=lazy(()=>import('@/features/cards/CardsPage').then(m=>({default:m.CardsPage})))
const CardsHubPage=lazy(()=>import('@/features/cards/CardsHubPage').then(m=>({default:m.CardsHubPage})))
const CardDetailPage=lazy(()=>import('@/features/cards/CardDetailPage').then(m=>({default:m.CardDetailPage})))
const BatchPrintPage=lazy(()=>import('@/features/cards/BatchPrintPage').then(m=>({default:m.BatchPrintPage})))
const PublicCardPlaceholderPage=lazy(()=>import('@/features/cards/PublicCardPlaceholderPage').then(m=>({default:m.PublicCardPlaceholderPage})))
const SalesPage=lazy(()=>import('@/features/sales/SalesPage').then(m=>({default:m.SalesPage})))
const SellersPage=lazy(()=>import('@/features/sellers/SellersPage').then(m=>({default:m.SellersPage})))
const SellerInvitePage=lazy(()=>import('@/features/sellers/SellerInvitePage').then(m=>({default:m.SellerInvitePage})))
const OperatorsPage=lazy(()=>import('@/features/operators/OperatorsPage').then(m=>({default:m.OperatorsPage})))
const OperatorInvitePage=lazy(()=>import('@/features/operators/OperatorInvitePage').then(m=>({default:m.OperatorInvitePage})))
const OperatorPanelSettingsPage=lazy(()=>import('@/features/operators/OperatorPanelSettingsPage').then(m=>({default:m.OperatorPanelSettingsPage})))
const DrawHomePage=lazy(()=>import('@/features/draw/DrawHomePage').then(m=>({default:m.DrawHomePage})))
const DrawPage=lazy(()=>import('@/features/draw/DrawPage').then(m=>({default:m.DrawPage})))
const HistoryPage=lazy(()=>import('@/features/history/HistoryPage').then(m=>({default:m.HistoryPage})))
const EventHistoryPage=lazy(()=>import('@/features/history/EventHistoryPage').then(m=>({default:m.EventHistoryPage})))
const SystemSettingsPage=lazy(()=>import('@/features/settings/SystemSettingsPage').then(m=>({default:m.SystemSettingsPage})))
const MasterPage=lazy(()=>import('@/features/master/MasterPage').then(m=>({default:m.MasterPage})))
const MasterConferencePage=lazy(()=>import('@/features/master/MasterConferencePage').then(m=>({default:m.MasterConferencePage})))
const MasterDrawSessionPage=lazy(()=>import('@/features/master/MasterDrawSessionPage').then(m=>({default:m.MasterDrawSessionPage})))
const AccessCenterPage=lazy(()=>import('@/features/access/AccessCenterPage').then(m=>({default:m.AccessCenterPage})))
const OrganizerCenterPage=lazy(()=>import('@/features/access/OrganizerCenterPage').then(m=>({default:m.OrganizerCenterPage})))
const SellerCenterPage=lazy(()=>import('@/features/access/SellerCenterPage').then(m=>({default:m.SellerCenterPage})))
const SellerEventPage=lazy(()=>import('@/features/access/SellerEventPage').then(m=>({default:m.SellerEventPage})))
const OperatorCenterPage=lazy(()=>import('@/features/access/OperatorCenterPage').then(m=>({default:m.OperatorCenterPage})))
const OperatorDrawPage=lazy(()=>import('@/features/access/OperatorEventPages').then(m=>({default:m.OperatorDrawPage})))
const OperatorTvPage=lazy(()=>import('@/features/access/OperatorEventPages').then(m=>({default:m.OperatorTvPage})))
const OperatorWinnersPage=lazy(()=>import('@/features/access/OperatorEventPages').then(m=>({default:m.OperatorWinnersPage})))
const WinnerRegistryPage=lazy(()=>import('@/features/winners/WinnerRegistryPage').then(m=>({default:m.WinnerRegistryPage})))
const BuyerCenterPage=lazy(()=>import('@/features/access/BuyerCenterPage').then(m=>({default:m.BuyerCenterPage})))
const BuyerEventPage=lazy(()=>import('@/features/access/BuyerEventPage').then(m=>({default:m.BuyerEventPage})))
const BuyerCardPage=lazy(()=>import('@/features/access/BuyerCardPage').then(m=>({default:m.BuyerCardPage})))
const NotFoundPage=lazy(()=>import('@/features/platform/NotFoundPage').then(m=>({default:m.NotFoundPage})))

function RouteLoading(){return <div className="p-6 text-sm font-semibold text-slate-500" role="status">Carregando…</div>}

export function AppRouter(){
  return <Suspense fallback={<RouteLoading/>}><Routes>
    <Route path="/entrar" element={<LoginPage/>}/><Route path="/criar-conta" element={<RegisterPage/>}/><Route path="/confirmar-email" element={<ConfirmEmailPage/>}/><Route path="/esqueci-senha" element={<ForgotPasswordPage/>}/><Route path="/redefinir-senha" element={<ResetPasswordPage/>}/>
    <Route path="/painel-publico/:publicSessionId" element={<PublicPanelPage/>}/><Route path="/c/:token" element={<PublicCardPlaceholderPage/>}/>
    <Route element={<RequireAuth/>}><Route path="/acessos" element={<AccessCenterPage/>}/><Route path="/organizador" element={<OrganizerCenterPage/>}/><Route path="/venda" element={<SellerCenterPage/>}/><Route element={<RequireEventAccess role="seller"/>}><Route path="/venda/:eventId" element={<SellerEventPage/>}/></Route><Route path="/operador" element={<OperatorCenterPage/>}/><Route element={<RequireEventAccess role="operator"/>}><Route path="/operador/:eventId/sorteio" element={<OperatorDrawPage/>}/><Route path="/operador/:eventId/tv" element={<OperatorTvPage/>}/><Route path="/operador/:eventId/ganhadores" element={<OperatorWinnersPage/>}/></Route><Route path="/cliente" element={<BuyerCenterPage/>}/><Route element={<RequireEventAccess role="buyer"/>}><Route path="/cliente/:eventId" element={<BuyerEventPage/>}/><Route path="/cliente/:eventId/cartela/:cardId" element={<BuyerCardPage/>}/></Route><Route element={<RequirePlatformOwner/>}><Route path="/master" element={<MasterPage/>}/><Route path="/master/conferencia/:candidateId" element={<MasterConferencePage/>}/><Route path="/master/sorteio/:sessionId" element={<MasterDrawSessionPage/>}/></Route><Route path="/convites/vendedor/:token" element={<SellerInvitePage/>}/><Route path="/convites/operador/:token" element={<OperatorInvitePage/>}/><Route element={<RequirePlatformAccess/>}><Route path="/configurar-organizador" element={<div className="bingoup-app min-h-dvh p-4"><WorkspaceOnboardingPage/></div>}/><Route element={<RequireWorkspace/>}><Route element={<AppShell/>}>
      <Route index element={<RoleHomePage/>}/>
      <Route path="eventos" element={<EventsPage/>}/><Route path="eventos/novo" element={<NewEventPage/>}/><Route path="eventos/:eventId" element={<EventDetailPage/>}/><Route path="eventos/:eventId/editar" element={<EditEventPage/>}/><Route path="eventos/:eventId/cartelas/configuracao" element={<CardConfigurationPage/>}/><Route path="eventos/:eventId/cartelas/gerar" element={<CardGeneratorPage/>}/><Route path="eventos/:eventId/cartelas" element={<CardsPage/>}/><Route path="eventos/:eventId/cartelas/:cardId" element={<CardDetailPage/>}/><Route path="eventos/:eventId/cartelas/lote/:batchId/imprimir" element={<BatchPrintPage/>}/><Route path="eventos/:eventId/vendas" element={<SalesPage/>}/><Route path="eventos/:eventId/sorteio" element={<DrawPage/>}/><Route path="eventos/:eventId/ganhadores" element={<WinnerRegistryPage/>}/><Route path="eventos/:eventId/painel-publico/configuracao" element={<OperatorPanelSettingsPage/>}/>
      <Route path="cartelas" element={<CardsHubPage/>}/><Route path="vendedores" element={<SellersPage/>}/><Route path="operadores" element={<OperatorsPage/>}/><Route path="vendas" element={<SalesPage/>}/><Route path="sorteio" element={<DrawHomePage/>}/><Route path="historico" element={<HistoryPage/>}/><Route path="eventos/:eventId/historico" element={<EventHistoryPage/>}/><Route path="configuracoes" element={<AccountPage/>}/><Route path="configuracoes/sistema" element={<SystemSettingsPage/>}/>
    </Route></Route></Route></Route>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes></Suspense>
}
