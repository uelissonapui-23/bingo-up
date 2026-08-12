export type ArtworkQuality='light'|'standard'|'high'
export type ArtworkFit='cover'|'contain'
export type CardArtworkOptions={path:string;zoom:number;offsetX:number;offsetY:number;quality:ArtworkQuality;fit:ArtworkFit}
export type WildcardKind='star'|'circle'|'heart'|'cross'|'fire'|'soccer'|'diamond'|'square'|'triangle'|'sun'|'moon'|'clover'|'flower'|'bolt'|'check'|'xmark'|'crown'|'target'|'ring'|'sparkle'|'custom'|'none'
export type CardWildcardOptions={kind:WildcardKind;path?:string;scale:number}
export type CardGameFont='helvetica'|'times'|'courier'
export type CardGameStyleOptions={
  numberColor:string
  gridColor:string
  cellBackground:string
  cellBackgroundOpacity:number
  headerBackground:string
  headerTextColor:string
  numberFont:CardGameFont
  headerFont:CardGameFont
  numberBold:boolean
  headerBold:boolean
  numberScale:number
  headerScale:number
  cornerRadius:number
  widthScale:number
  heightScale:number
  cellGap:number
  gridLineWidth:number
  headerHeight:number
}
export type CardTemplateOptions={version:1;artwork?:CardArtworkOptions;wildcard?:CardWildcardOptions;gameStyle?:CardGameStyleOptions}

export const DEFAULT_WILDCARD:CardWildcardOptions={kind:'star',scale:1}
export const DEFAULT_GAME_STYLE:CardGameStyleOptions={
  numberColor:'#0f172a',gridColor:'#64748b',cellBackground:'#ffffff',cellBackgroundOpacity:1,headerBackground:'#111827',headerTextColor:'#ffffff',
  numberFont:'helvetica',headerFont:'helvetica',numberBold:true,headerBold:true,numberScale:1,headerScale:1,
  cornerRadius:0,widthScale:1,heightScale:1,cellGap:0,gridLineWidth:1,headerHeight:13,
}

export function parseCardTemplateOptions(value:Record<string,unknown>|null|undefined):CardTemplateOptions{
  const raw=value??{}
  const artworkRaw=isRecord(raw.artwork)?raw.artwork:null
  const wildcardRaw=isRecord(raw.wildcard)?raw.wildcard:null
  const styleRaw=isRecord(raw.gameStyle)?raw.gameStyle:null
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
  const gameStyle:CardGameStyleOptions=styleRaw?{
    numberColor:color(styleRaw.numberColor,DEFAULT_GAME_STYLE.numberColor),
    gridColor:color(styleRaw.gridColor,DEFAULT_GAME_STYLE.gridColor),
    cellBackground:color(styleRaw.cellBackground,DEFAULT_GAME_STYLE.cellBackground),
    cellBackgroundOpacity:numberInRange(styleRaw.cellBackgroundOpacity,0,1,DEFAULT_GAME_STYLE.cellBackgroundOpacity),
    headerBackground:color(styleRaw.headerBackground,DEFAULT_GAME_STYLE.headerBackground),
    headerTextColor:color(styleRaw.headerTextColor,DEFAULT_GAME_STYLE.headerTextColor),
    numberFont:isGameFont(styleRaw.numberFont)?styleRaw.numberFont:DEFAULT_GAME_STYLE.numberFont,
    headerFont:isGameFont(styleRaw.headerFont)?styleRaw.headerFont:DEFAULT_GAME_STYLE.headerFont,
    numberBold:typeof styleRaw.numberBold==='boolean'?styleRaw.numberBold:DEFAULT_GAME_STYLE.numberBold,
    headerBold:typeof styleRaw.headerBold==='boolean'?styleRaw.headerBold:DEFAULT_GAME_STYLE.headerBold,
    numberScale:numberInRange(styleRaw.numberScale,.65,1.5,DEFAULT_GAME_STYLE.numberScale),
    headerScale:numberInRange(styleRaw.headerScale,.65,1.5,DEFAULT_GAME_STYLE.headerScale),
    cornerRadius:numberInRange(styleRaw.cornerRadius,0,24,DEFAULT_GAME_STYLE.cornerRadius),
    widthScale:numberInRange(styleRaw.widthScale,.65,1,DEFAULT_GAME_STYLE.widthScale),
    heightScale:numberInRange(styleRaw.heightScale,.65,1,DEFAULT_GAME_STYLE.heightScale),
    cellGap:numberInRange(styleRaw.cellGap,0,6,DEFAULT_GAME_STYLE.cellGap),
    gridLineWidth:numberInRange(styleRaw.gridLineWidth,.25,3,DEFAULT_GAME_STYLE.gridLineWidth),
    headerHeight:numberInRange(styleRaw.headerHeight,8,24,DEFAULT_GAME_STYLE.headerHeight),
  }:DEFAULT_GAME_STYLE
  return {version:1,artwork,wildcard,gameStyle}
}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value)}
function isQuality(value:unknown):value is ArtworkQuality{return value==='light'||value==='standard'||value==='high'}
function isFit(value:unknown):value is ArtworkFit{return value==='cover'||value==='contain'}
function isWildcardKind(value:unknown):value is WildcardKind{return ['star','circle','heart','cross','fire','soccer','diamond','square','triangle','sun','moon','clover','flower','bolt','check','xmark','crown','target','ring','sparkle','custom','none'].includes(String(value))}
function isGameFont(value:unknown):value is CardGameFont{return value==='helvetica'||value==='times'||value==='courier'}
function color(value:unknown,fallback:string){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback}
function numberInRange(value:unknown,min:number,max:number,fallback:number){const n=typeof value==='number'?value:Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
