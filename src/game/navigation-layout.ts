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
