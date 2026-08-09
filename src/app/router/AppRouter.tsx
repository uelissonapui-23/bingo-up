import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/app/guards/RequireAuth'
import { RequireWorkspace } from '@/app/guards/RequireWorkspace'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { WorkspaceOnboardingPage } from '@/features/workspace/WorkspaceOnboardingPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { AccountPage } from '@/features/account/AccountPage'
import { PublicPanelPage } from '@/features/public-panel/PublicPanelPage'
import { EventsPage } from '@/features/events/EventsPage'
import { NewEventPage } from '@/features/events/NewEventPage'
import { EventDetailPage } from '@/features/events/EventDetailPage'
import { EditEventPage } from '@/features/events/EditEventPage'
import { CardConfigurationPage } from '@/features/card-config/CardConfigurationPage'
import { CardGeneratorPage } from '@/features/card-generator/CardGeneratorPage'
import { CardsPage } from '@/features/cards/CardsPage'
import { CardsHubPage } from '@/features/cards/CardsHubPage'
import { CardDetailPage } from '@/features/cards/CardDetailPage'
import { BatchPrintPage } from '@/features/cards/BatchPrintPage'
import { PublicCardPlaceholderPage } from '@/features/cards/PublicCardPlaceholderPage'
import { SalesPage } from '@/features/sales/SalesPage'
import { DrawHomePage } from '@/features/draw/DrawHomePage'
import { DrawPage } from '@/features/draw/DrawPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { EventHistoryPage } from '@/features/history/EventHistoryPage'
import { SystemSettingsPage } from '@/features/settings/SystemSettingsPage'
import { NotFoundPage } from '@/features/platform/NotFoundPage'

export function AppRouter() {
  return <Routes>
    <Route path="/entrar" element={<LoginPage/>}/><Route path="/criar-conta" element={<RegisterPage/>}/><Route path="/esqueci-senha" element={<ForgotPasswordPage/>}/><Route path="/redefinir-senha" element={<ResetPasswordPage/>}/>
    <Route path="/painel-publico/:publicSessionId" element={<PublicPanelPage/>}/><Route path="/c/:token" element={<PublicCardPlaceholderPage/>}/>
    <Route element={<RequireAuth/>}><Route path="/configurar-organizador" element={<div className="bingoup-app min-h-dvh p-4"><WorkspaceOnboardingPage/></div>}/><Route element={<RequireWorkspace/>}><Route element={<AppShell/>}>
      <Route index element={<DashboardPage/>}/>
      <Route path="eventos" element={<EventsPage/>}/><Route path="eventos/novo" element={<NewEventPage/>}/><Route path="eventos/:eventId" element={<EventDetailPage/>}/><Route path="eventos/:eventId/editar" element={<EditEventPage/>}/><Route path="eventos/:eventId/cartelas/configuracao" element={<CardConfigurationPage/>}/><Route path="eventos/:eventId/cartelas/gerar" element={<CardGeneratorPage/>}/><Route path="eventos/:eventId/cartelas" element={<CardsPage/>}/><Route path="eventos/:eventId/cartelas/:cardId" element={<CardDetailPage/>}/><Route path="eventos/:eventId/cartelas/lote/:batchId/imprimir" element={<BatchPrintPage/>}/><Route path="eventos/:eventId/vendas" element={<SalesPage/>}/><Route path="eventos/:eventId/sorteio" element={<DrawPage/>}/>
      <Route path="cartelas" element={<CardsHubPage/>}/><Route path="vendas" element={<SalesPage/>}/><Route path="sorteio" element={<DrawHomePage/>}/><Route path="historico" element={<HistoryPage/>}/><Route path="eventos/:eventId/historico" element={<EventHistoryPage/>}/><Route path="configuracoes" element={<AccountPage/>}/><Route path="configuracoes/sistema" element={<SystemSettingsPage/>}/>
    </Route></Route></Route>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes>
}
