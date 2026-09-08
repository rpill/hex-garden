export interface ChapterGridMetrics {
  columns: number;
  rowsPerChapter: number;
  gapX: number;
  gapY: number;
  tileWidth: number;
  tileHeight: number;
  gridWidth: number;
  labelHeight: number;
  chapterGap: number;
  sectionHeight: number;
  totalHeight: number;
}

export function chapterGridMetrics(
  width: number,
  height: number,
  contentTop = 92,
): Readonly<ChapterGridMetrics> {
  const shortLandscape = height < 520 && width > height;
  const columns = width >= 700 ? 10 : 5;
  const rowsPerChapter = Math.ceil(10 / columns);
  const gapX = width < 520 ? 6 : 8;
  const gapY = shortLandscape ? 4 : 6;
  const sidePadding = width < 520 ? 14 : 24;
  const gridWidth = Math.min(Math.max(1, width - sidePadding * 2), 980);
  const tileWidth = Math.floor((gridWidth - gapX * (columns - 1)) / columns);
  const labelHeight = shortLandscape ? 16 : 18;
  const chapterGap = shortLandscape ? 6 : 10;
  const bottomPadding = shortLandscape ? 8 : 12;
  const availableHeight = Math.max(1, height - contentTop - bottomPadding);
  const fixedHeight =
    5 * labelHeight +
    4 * chapterGap +
    5 * Math.max(0, rowsPerChapter - 1) * gapY;
  const rawTileHeight = Math.floor(
    Math.max(1, availableHeight - fixedHeight) / (5 * rowsPerChapter),
  );
  const minTileHeight = shortLandscape ? 28 : 40;
  const tileHeight = Math.max(minTileHeight, Math.min(52, rawTileHeight));
  const sectionHeight =
    labelHeight + rowsPerChapter * tileHeight + Math.max(0, rowsPerChapter - 1) * gapY;
  const totalHeight = 5 * sectionHeight + 4 * chapterGap;

  return Object.freeze({
    columns,
    rowsPerChapter,
    gapX,
    gapY,
    tileWidth,
    tileHeight,
    gridWidth,
    labelHeight,
    chapterGap,
    sectionHeight,
    totalHeight,
  });
}

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

export function inventoryCountOffset(radius:number): Readonly<{x:number;y:number}> {
  return Object.freeze({x:Math.max(12,radius*0.95),y:0});
}
export const COMPLETION_DEPTHS=Object.freeze({dim:50,card:51,progress:53,content:54} as const);
export interface CompletionActionOptions { primaryHeight?:number; secondaryHeight?:number; gap?:number; bottomPadding?:number; }
export function completionActionMetrics(cardHeight:number,{primaryHeight=40,secondaryHeight=34,gap=12,bottomPadding=20}:CompletionActionOptions={}):Readonly<{primaryY:number;secondaryY:number;gap:number}>{
  const secondaryY=cardHeight-bottomPadding-secondaryHeight/2; const primaryY=secondaryY-secondaryHeight/2-gap-primaryHeight/2; return Object.freeze({primaryY,secondaryY,gap});
}
