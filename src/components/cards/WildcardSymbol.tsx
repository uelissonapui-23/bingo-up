import type { CardWildcardOptions, WildcardKind } from '@/domain/cards/templateOptions'
import { getCardAssetUrl } from '@/features/card-config/cardConfigService'

const SYMBOLS:Record<Exclude<WildcardKind,'custom'|'none'>,string>={
  star:'★',circle:'●',heart:'♥',cross:'✚',fire:'🔥',soccer:'⚽',diamond:'◆',square:'■',triangle:'▲',
  sun:'☀',moon:'☾',clover:'♣',flower:'✿',bolt:'⚡',check:'✓',xmark:'✕',crown:'♛',target:'◎',ring:'○',sparkle:'✦',
}

export function WildcardSymbol({config,className=''}:{config:CardWildcardOptions;className?:string}){
  if(config.kind==='none')return null
  const style={transform:`scale(${config.scale})`}
  if(config.kind==='custom'&&config.path){const url=getCardAssetUrl(config.path);return url?<img className={`wildcard-image ${className}`} style={style} src={url} alt="Coringa"/>:null}
  if(config.kind==='custom')return null
  return <span className={`wildcard-symbol ${className}`} style={style}>{SYMBOLS[config.kind]}</span>
}
