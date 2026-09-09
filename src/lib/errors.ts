export class AppError extends Error {
  constructor(message: string, public readonly code = 'APP_ERROR', public override readonly cause?: unknown) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) { super(message, 'VALIDATION_ERROR', cause) }
}

export class PermissionError extends AppError {
  constructor(message = 'Você não tem permissão para realizar esta ação.') { super(message, 'PERMISSION_DENIED') }
}

export class ConflictError extends AppError {
  constructor(message: string) { super(message, 'CONFLICT') }
}

type ErrorLike={message?:unknown}

const translated:Record<string,string>={
  'access denied':'Você não possui permissão para realizar esta ação neste evento.',
  'workspace access denied':'Seu acesso ao evento não permite concluir esta ação.',
  'buyer name required':'Informe o nome do comprador para concluir a venda.',
  'no eligible sold tickets':'Não existem números vendidos disponíveis para este sorteio.',
  'no symbols remaining':'Todos os símbolos deste evento já foram sorteados.',
  'not enough symbols':'Cadastre símbolos suficientes para gerar as cartelas.',
  'cannot change symbols after cards are generated':'O tema não pode ser alterado enquanto houver cartelas temáticas geradas.',
}

export function getErrorMessage(error:unknown,fallback:string){
  const value=typeof error==='object'&&error!==null?error as ErrorLike:null
  const raw=error instanceof Error?error.message:typeof value?.message==='string'?value.message:''
  if(!raw)return fallback
  return translated[raw.trim().toLowerCase()]??raw
}
