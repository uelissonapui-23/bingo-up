export type ModuleRoute = {
  path: string
  module: number
  title: string
  description: string
}

export const moduleRoutes: ModuleRoute[] = [
  { path: '/acesso', module: 1, title: 'Acesso e isolamento', description: 'Autenticação, workspaces, papéis e RLS.' },
  { path: '/organizadores', module: 2, title: 'Organizadores e equipe', description: 'Estrutura operacional de cada organizador.' },
  { path: '/eventos', module: 3, title: 'Eventos', description: 'Múltiplos eventos independentes por workspace.' },
  { path: '/vendedores', module: 4, title: 'Vendedores', description: 'Convites, vínculos e links por evento.' },
  { path: '/regras-cartelas', module: 5, title: 'Regras e templates', description: 'Modelos 1 em 1, 2 em 1, 3 em 1 e layouts.' },
  { path: '/gerador', module: 6, title: 'Motor de geração', description: 'Unicidade, capacidade e repetição controlada.' },
  { path: '/cartelas', module: 7, title: 'Cartelas', description: 'Gerenciamento de cartelas geradas, visualização, impressão e PDF.' },
  { path: '/vendas', module: 8, title: 'Vendas', description: 'Venda individual, lote e área do vendedor.' },
  { path: '/sorteio', module: 9, title: 'Sorteio', description: 'Sorteio acionado manualmente e histórico.' },
  { path: '/acompanhamento', module: 10, title: 'Acompanhamento', description: 'Proximidade e detecção automática de prêmio.' },
  { path: '/premiacao', module: 11, title: 'Conferência e premiação', description: 'Validação de cartelas e vencedores.' },
  { path: '/painel-publico', module: 12, title: 'Painel público', description: 'TV, projetor ou segunda tela em tempo real.' },
  { path: '/historico', module: 13, title: 'Dashboard e histórico', description: 'Visão consolidada e auditoria operacional.' },
  { path: '/configuracoes', module: 14, title: 'Configurações', description: 'Preferências e preparação comercial.' }
]
