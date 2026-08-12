const SAFE_PREFIXES=['/convites/vendedor/','/convites/operador/']

export function normalizeAuthReturnPath(value:string|null|undefined){
  if(!value)return null
  try{
    const decoded=decodeURIComponent(value)
    if(!decoded.startsWith('/')||decoded.startsWith('//'))return null
    if(SAFE_PREFIXES.some(prefix=>decoded.startsWith(prefix)))return decoded
    if(['/acessos','/organizador','/venda','/operador','/cliente','/master'].includes(decoded))return decoded
    return null
  }catch{return null}
}

export function authReturnQuery(path:string|null|undefined){
  const safe=normalizeAuthReturnPath(path)
  return safe?`?next=${encodeURIComponent(safe)}`:''
}
