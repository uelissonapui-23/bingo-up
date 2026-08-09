export type BuyerRequirements = { requireName:boolean; requirePhone:boolean; requireEmail:boolean }
export type BuyerDraft = { name:string; phone:string; email:string }

export function validateBuyer(requirements:BuyerRequirements,buyer:BuyerDraft){
  if(requirements.requireName&&!buyer.name.trim())return 'Informe o nome do comprador.'
  if(requirements.requirePhone&&!buyer.phone.trim())return 'Informe o telefone do comprador.'
  if(requirements.requireEmail&&!buyer.email.trim())return 'Informe o e-mail do comprador.'
  if(buyer.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email.trim()))return 'Informe um e-mail válido.'
  return null
}

export function normalizeMoneyInput(value:string){
  const cleaned=value.trim().replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.')
  const parsed=Number(cleaned)
  return Number.isFinite(parsed)&&parsed>=0?Math.round(parsed*100)/100:null
}
