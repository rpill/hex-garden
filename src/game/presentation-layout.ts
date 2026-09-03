export interface LevelGridMetrics { columns:number; rows:number; gapX:number; gapY:number; tileWidth:number; tileHeight:number; gridWidth:number; gridHeight:number; }
export function levelGridMetrics(width:number,height:number,itemCount:number,contentTop=72): Readonly<LevelGridMetrics> {
  const columns=width>=1000?6:width>=700?5:width>=480?4:3; const rows=Math.ceil(itemCount/columns); const gapX=width<480?8:12; const gapY=gapX;
  const maxGridWidth=Math.min(width-28,940); const tileWidth=Math.floor((maxGridWidth-gapX*(columns-1))/columns); const usableHeight=Math.max(240,height-contentTop-36);
  const tileHeight=Math.max(72,Math.min(112,Math.floor((usableHeight-gapY*(rows-1))/rows))); const gridWidth=tileWidth*columns+gapX*(columns-1); const gridHeight=tileHeight*rows+gapY*(rows-1);
  return Object.freeze({columns,rows,gapX,gapY,tileWidth,tileHeight,gridWidth,gridHeight});
}
export interface ShopGridMetrics { columns:number; rows:number; gap:number; cardWidth:number; cardHeight:number; maxGridWidth:number; contentTop:number; }
export function shopGridMetrics(width:number,height:number,itemCount:number,contentTop=72): Readonly<ShopGridMetrics> {
  const shortLandscape=height<650&&width>=540; const columns=width>=820||shortLandscape?Math.min(3,itemCount):width>=560?2:1; const rows=Math.ceil(itemCount/columns);
  const gap=width<560?12:shortLandscape?10:18; const maxGridWidth=Math.min(width-28,1040); const cardWidth=Math.floor((maxGridWidth-gap*(columns-1))/columns); const cardHeight=columns===1?190:shortLandscape?250:300;
  return Object.freeze({columns,rows,gap,cardWidth,cardHeight,maxGridWidth,contentTop});
}
export interface CompletionCardMetrics { width:number; height:number; compact:boolean; short:boolean; }
export function completionCardMetrics(width:number,height:number,{hasUnlock=false}:{hasUnlock?:boolean}={}): Readonly<CompletionCardMetrics> {
  const compact=width<560; const short=height<520; const cardWidth=Math.min(width-24,compact?520:560); const baseHeight=short?330:compact?380:360; const cardHeight=Math.min(height-20,baseHeight+(hasUnlock?34:0));
  return Object.freeze({width:cardWidth,height:cardHeight,compact,short});
}
export interface InventoryAnchorOptions { boardBottom:number; panelHeight:number; viewportHeight:number; gap?:number; bottomPadding?:number; }
export function inventoryAnchorMetrics({boardBottom,panelHeight,viewportHeight,gap=14,bottomPadding=10}:InventoryAnchorOptions): Readonly<{top:number;centerY:number}> {
  const desiredTop=boardBottom+gap; const maximumTop=Math.max(0,viewportHeight-panelHeight-bottomPadding); const top=Math.min(desiredTop,maximumTop); return Object.freeze({top,centerY:top+panelHeight/2});
}
export const COMPLETION_DEPTHS=Object.freeze({dim:50,card:51,progress:53,content:54} as const);
export interface CompletionActionOptions { primaryHeight?:number; secondaryHeight?:number; gap?:number; bottomPadding?:number; }
export function completionActionMetrics(cardHeight:number,{primaryHeight=40,secondaryHeight=34,gap=12,bottomPadding=20}:CompletionActionOptions={}):Readonly<{primaryY:number;secondaryY:number;gap:number}>{
  const secondaryY=cardHeight-bottomPadding-secondaryHeight/2; const primaryY=secondaryY-secondaryHeight/2-gap-primaryHeight/2; return Object.freeze({primaryY,secondaryY,gap});
}
