export type ArtworkQuality='light'|'standard'|'high'
export type ArtworkFit='cover'|'contain'
export type CardArtworkOptions={path:string;zoom:number;offsetX:number;offsetY:number;quality:ArtworkQuality;fit:ArtworkFit}
export type WildcardKind='star'|'circle'|'heart'|'cross'|'fire'|'soccer'|'custom'|'none'
export type CardWildcardOptions={kind:WildcardKind;path?:string;scale:number}
export type CardTemplateOptions={version:1;artwork?:CardArtworkOptions;wildcard?:CardWildcardOptions}

export const DEFAULT_WILDCARD:CardWildcardOptions={kind:'star',scale:1}

export function parseCardTemplateOptions(value:Record<string,unknown>|null|undefined):CardTemplateOptions{
  const raw=value??{}
  const artworkRaw=isRecord(raw.artwork)?raw.artwork:null
  const wildcardRaw=isRecord(raw.wildcard)?raw.wildcard:null
  const artwork=artworkRaw&&typeof artworkRaw.path==='string'?{
    path:artworkRaw.path,
    zoom:numberInRange(artworkRaw.zoom,.5,3,1),
    offsetX:numberInRange(artworkRaw.offsetX,-60,60,0),
    offsetY:numberInRange(artworkRaw.offsetY,-60,60,0),
    quality:isQuality(artworkRaw.quality)?artworkRaw.quality:'standard',
    fit:isFit(artworkRaw.fit)?artworkRaw.fit:'cover',
  } satisfies CardArtworkOptions:undefined
  const wildcard:CardWildcardOptions=wildcardRaw?{
    kind:isWildcardKind(wildcardRaw.kind)?wildcardRaw.kind:'star',
    path:typeof wildcardRaw.path==='string'?wildcardRaw.path:undefined,
    scale:numberInRange(wildcardRaw.scale,.35,1.8,1),
  }:DEFAULT_WILDCARD
  return {version:1,artwork,wildcard}
}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value)}
function isQuality(value:unknown):value is ArtworkQuality{return value==='light'||value==='standard'||value==='high'}
function isFit(value:unknown):value is ArtworkFit{return value==='cover'||value==='contain'}
function isWildcardKind(value:unknown):value is WildcardKind{return value==='star'||value==='circle'||value==='heart'||value==='cross'||value==='fire'||value==='soccer'||value==='custom'||value==='none'}
function numberInRange(value:unknown,min:number,max:number,fallback:number){const n=typeof value==='number'?value:Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
