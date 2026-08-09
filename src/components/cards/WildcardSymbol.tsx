import type { CardWildcardOptions } from '@/domain/cards/templateOptions'
import { getCardAssetUrl } from '@/features/card-config/cardConfigService'

export function WildcardSymbol({config,className=''}:{config:CardWildcardOptions;className?:string}){
  if(config.kind==='none')return null
  const style={transform:`scale(${config.scale})`}
  if(config.kind==='custom'&&config.path){const url=getCardAssetUrl(config.path);return url?<img className={`wildcard-image ${className}`} style={style} src={url} alt="Coringa"/>:null}
  const symbol=config.kind==='circle'?'●':config.kind==='heart'?'♥':config.kind==='cross'?'✦':config.kind==='fire'?'🔥':config.kind==='soccer'?'⚽':'★'
  return <span className={`wildcard-symbol ${className}`} style={style}>{symbol}</span>
}
