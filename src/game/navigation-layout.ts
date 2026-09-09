import type Phaser from "phaser";
import { isShortLandscape } from "./responsive-layout.js";
export interface SceneHeaderMetrics { compact:boolean; shortLandscape:boolean; headerHeight:number; controlHeight:number; y:number; backX:number; backWidth:number; titleX:number; rightX:number; utilitySize:number; utilityGap:number; utilityXs:(count:number)=>number[]; contentTop:number; }
export function sceneHeaderMetrics(width:number,height:number):Readonly<SceneHeaderMetrics>{
  const shortLandscape=isShortLandscape(width,height); const compact=width<520; const headerHeight=shortLandscape?52:64; const controlHeight=shortLandscape?40:42; const margin=compact?10:14; const backWidth=compact?92:108; const utilitySize=controlHeight; const utilityGap=8;
  const utilityXs=(count:number):number[]=>Array.from({length:count},(_,index)=>width-margin-utilitySize/2-index*(utilitySize+utilityGap));
  return Object.freeze({compact,shortLandscape,headerHeight,controlHeight,y:headerHeight/2,backX:margin+backWidth/2,backWidth,titleX:width/2,rightX:width-margin-utilitySize/2,utilitySize,utilityGap,utilityXs,contentTop:headerHeight+8});
}
export interface SceneHeaderObjects { title?:Phaser.GameObjects.Text; backButton?:Phaser.GameObjects.Container & {setFontSize?:(size:number)=>unknown;setFixedSize?:(width:number,height:number)=>unknown}; utilityButtons?:Array<Phaser.GameObjects.Container & {setFixedSize?:(width:number,height:number)=>unknown}>; utilityButton?:Phaser.GameObjects.Container & {setFixedSize?:(width:number,height:number)=>unknown}; utilityText?:Phaser.GameObjects.Text; }
export function layoutSceneHeader({title,backButton,utilityButtons=[],utilityButton,utilityText}:SceneHeaderObjects,width:number,height:number):Readonly<SceneHeaderMetrics>{
  const metrics=sceneHeaderMetrics(width,height);
  title?.setFontSize(metrics.compact?19:metrics.shortLandscape?20:24).setPosition(metrics.titleX,metrics.y);
  backButton?.setFontSize?.(metrics.compact?11:12); backButton?.setFixedSize?.(metrics.backWidth,metrics.controlHeight); backButton?.setPosition(metrics.backX,metrics.y);
  const utilities=utilityButtons.length>0?utilityButtons:utilityButton?[utilityButton]:[]; const xs=metrics.utilityXs(utilities.length);
  utilities.forEach((button,index)=>{button.setFixedSize?.(metrics.utilitySize,metrics.controlHeight); const x=xs[index]; if(x!==undefined)button.setPosition(x,metrics.y);});
  const utilityTextX=utilities.length>0?(xs[xs.length-1]??width-14)-metrics.utilitySize/2-metrics.utilityGap:width-14;
  utilityText?.setFontSize(metrics.compact?10:12).setPosition(utilityTextX,metrics.y);
  return metrics;
}


export interface HomeLayoutMetrics {
  compact: boolean;
  shortLandscape: boolean;
  centerX: number;
  titleY: number;
  subtitleY: number;
  progressY: number;
  primaryY: number;
  secondaryY: number;
  primaryWidth: number;
  primaryHeight: number;
  secondaryWidth: number;
  secondaryHeight: number;
  secondaryGap: number;
}

export function homeLayoutMetrics(width: number, height: number): Readonly<HomeLayoutMetrics> {
  const compact = width < 520;
  const shortLandscape = isShortLandscape(width, height);
  const centerX = width / 2;

  if (shortLandscape) {
    return Object.freeze({
      compact,
      shortLandscape,
      centerX,
      titleY: Math.max(48, height * 0.2),
      subtitleY: Math.max(78, height * 0.3),
      progressY: Math.max(108, height * 0.4),
      primaryY: Math.max(154, height * 0.57),
      secondaryY: Math.max(214, height * 0.78),
      primaryWidth: Math.min(420, width - 64),
      primaryHeight: 54,
      secondaryWidth: Math.min(180, (width - 84) / 2),
      secondaryHeight: 44,
      secondaryGap: 12,
    });
  }

  return Object.freeze({
    compact,
    shortLandscape,
    centerX,
    titleY: Math.max(86, height * 0.18),
    subtitleY: Math.max(122, height * 0.24),
    progressY: Math.max(166, height * 0.32),
    primaryY: Math.max(246, height * 0.47),
    secondaryY: Math.max(318, height * 0.6),
    primaryWidth: Math.min(compact ? width - 40 : 420, 420),
    primaryHeight: compact ? 56 : 60,
    secondaryWidth: Math.min(compact ? (width - 52) / 2 : 190, 190),
    secondaryHeight: 46,
    secondaryGap: compact ? 10 : 14,
  });
}


export interface HomeDailyGroupMetrics {
  actionHeight: number;
  archiveHeight: number;
  sectionGap: number;
  groupPadding: number;
  groupHeight: number;
  groupY: number;
  actionY: number;
  archiveY: number;
}

export function homeDailyGroupMetrics(
  home: Pick<HomeLayoutMetrics, "shortLandscape" | "primaryY">,
): Readonly<HomeDailyGroupMetrics> {
  const actionHeight = home.shortLandscape ? 46 : 88;
  const archiveHeight = home.shortLandscape ? 20 : 34;
  const sectionGap = home.shortLandscape ? 5 : 8;
  const groupPadding = home.shortLandscape ? 4 : 6;
  const groupHeight = actionHeight + archiveHeight + sectionGap + groupPadding * 2;
  const groupY = home.primaryY + (home.shortLandscape ? 74 : 112);
  const actionY = groupY - groupHeight / 2 + groupPadding + actionHeight / 2;
  const archiveY = actionY + actionHeight / 2 + sectionGap + archiveHeight / 2;

  return Object.freeze({
    actionHeight,
    archiveHeight,
    sectionGap,
    groupPadding,
    groupHeight,
    groupY,
    actionY,
    archiveY,
  });
}
