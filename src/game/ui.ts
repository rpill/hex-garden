import Phaser from "phaser";
import { GAMEPLAY_FONT, ART_ASSET_URLS, THEME_COLORS, UI_FRAMES } from "../art-assets.js";
import { buttonVisualState, type ButtonSemanticState } from "./presentation-model.js";

type UiFrame = string;
interface SurfaceColor { fill:number; line:number; alpha:number; }
function colorStyleForFrame(frame:UiFrame):SurfaceColor{
  if(frame===UI_FRAMES.levelCurrent)return{fill:0x244d68,line:0x4f89ad,alpha:0.96};
  if(frame===UI_FRAMES.levelCompleted||frame===UI_FRAMES.panelSuccess)return{fill:0x203b2b,line:0x4d8b61,alpha:0.96};
  if(frame===UI_FRAMES.panelFailure)return{fill:0x3d2323,line:0x8f4c48,alpha:0.96};
  if(frame===UI_FRAMES.levelLocked||frame===UI_FRAMES.buttonDisabled)return{fill:0x151a21,line:0x2d3540,alpha:0.84};
  if(frame===UI_FRAMES.buttonSelected)return{fill:0x29323d,line:0x667384,alpha:0.98};
  return{fill:0x1a2029,line:0x3a4552,alpha:0.94};
}

export class RendererSurface extends Phaser.GameObjects.Graphics{
  frameKey:UiFrame; surfaceWidth=280; surfaceHeight=120; hovered=false; pressed=false;
  constructor(scene:Phaser.Scene,frame:UiFrame=UI_FRAMES.panelMainMedium,depth=0){super(scene);scene.add.existing(this);this.frameKey=frame;this.setDepth(depth);this.redraw();}
  setTexture(frame:UiFrame):this{this.frameKey=frame;this.redraw();return this;}
  resizeSurface(width:number,height:number):this{this.surfaceWidth=Math.max(1,width);this.surfaceHeight=Math.max(1,height);this.redraw();return this;}
  setHover(hovered:boolean):this{this.hovered=hovered;this.redraw();return this;}
  setPressed(pressed:boolean):this{this.pressed=pressed;this.redraw();return this;}
  redraw():this{const{fill,line,alpha}=colorStyleForFrame(this.frameKey);const hoverBoost=this.hovered?0.08:0;const pressedBoost=this.pressed?0.12:0;const radius=Math.max(6,Math.min(12,this.surfaceHeight*0.18));this.clear();this.fillStyle(fill,Math.min(1,alpha+hoverBoost+pressedBoost));this.fillRoundedRect(-this.surfaceWidth/2,-this.surfaceHeight/2,this.surfaceWidth,this.surfaceHeight,radius);this.lineStyle(1,line,this.hovered?0.9:0.62);this.strokeRoundedRect(-this.surfaceWidth/2+0.5,-this.surfaceHeight/2+0.5,this.surfaceWidth-1,this.surfaceHeight-1,radius);return this;}
}

export function preloadUiAssets(scene:Phaser.Scene):void{for(const[key,url]of Object.entries(ART_ASSET_URLS)){if(!scene.textures.exists(key))scene.load.image(key,url);}}
export function makeText(scene:Phaser.Scene,text:string,size:number,color:string=THEME_COLORS.text):Phaser.GameObjects.Text{
  const value=scene.add.text(0,0,text,{fontFamily:`${GAMEPLAY_FONT.family}, Arial, "Segoe UI", sans-serif`,fontSize:`${size}px`,color,align:"center"});return value.setResolution(Math.min(2,globalThis.devicePixelRatio||1));
}

type ResizableSurface=RendererSurface|Phaser.GameObjects.NineSlice;
export function resizeNineSlice(surface:ResizableSurface,width:number,height:number):ResizableSurface{
  if(surface instanceof RendererSurface)return surface.resizeSurface(width,height);
  const frameWidth=Math.max(1,surface.frame?.width??width);const frameHeight=Math.max(1,surface.frame?.height??height);const scale=Math.max(0.01,Math.min(width/frameWidth,height/frameHeight));surface.setSize(width/scale,height/scale).setScale(scale);return surface;
}
export function makePanel(scene:Phaser.Scene,frame:UiFrame=UI_FRAMES.panelMainMedium,depth=0):RendererSurface{return new RendererSurface(scene,frame,depth);}

const BUTTON_FRAMES=Object.freeze({idle:UI_FRAMES.buttonIdle,hover:UI_FRAMES.buttonHover,selected:UI_FRAMES.buttonSelected,disabled:UI_FRAMES.buttonDisabled});
const LEVEL_FRAMES=Object.freeze({idle:UI_FRAMES.levelIdle,current:UI_FRAMES.levelCurrent,completed:UI_FRAMES.levelCompleted,locked:UI_FRAMES.levelLocked,disabled:UI_FRAMES.levelLocked});
type FrameSet=Readonly<Record<string,string>>;
type PositionableIcon=Phaser.GameObjects.Image|Phaser.GameObjects.Graphics;

export class AtlasButton extends Phaser.GameObjects.Container{
  background:RendererSurface; label:Phaser.GameObjects.Text; frames:FrameSet; level:boolean; semanticState:ButtonSemanticState="idle"; baseFrame:string; enabled=true; hovered=false; pressed=false; buttonWidth:number; buttonHeight:number; icon:PositionableIcon|undefined; iconOnly=false;
  constructor(scene:Phaser.Scene,label:string,onClick:()=>void,size=16,{level=false}:{level?:boolean}={}){
    const frames:FrameSet=level?LEVEL_FRAMES:BUTTON_FRAMES;const background=makePanel(scene,frames.idle??UI_FRAMES.buttonIdle);const text=makeText(scene,label,size,THEME_COLORS.text).setOrigin(0.5).setAlign("center").setFontStyle("bold");
    super(scene,0,0,[background,text]);scene.add.existing(this);this.background=background;this.label=text;this.frames=frames;this.level=level;this.baseFrame=frames.idle??UI_FRAMES.buttonIdle;this.buttonWidth=level?72:180;this.buttonHeight=level?52:50;
    this.setFixedSize(this.buttonWidth,this.buttonHeight);this.setInteractive({useHandCursor:true});
    this.on("pointerover",()=>{if(!this.enabled)return;this.hovered=true;this.applyVisualState();});this.on("pointerout",()=>{this.hovered=false;this.pressed=false;this.applyVisualState();});
    this.on("pointerdown",()=>{if(!this.enabled)return;this.pressed=true;this.applyVisualState();});this.on("pointerup",()=>{if(!this.enabled)return;this.pressed=false;this.applyVisualState();});this.on("pointerdown",onClick);
  }
  applyVisualState():this{const state=buttonVisualState({semanticState:this.semanticState,hovered:this.hovered,pressed:this.pressed,enabled:this.enabled});this.background.setTexture(this.baseFrame).setHover(state.enabled&&this.hovered).setPressed(state.enabled&&this.pressed);this.setScale(state.scale).setAlpha(state.alpha);return this;}
  setFixedSize(width:number,height:number):this{this.buttonWidth=width;this.buttonHeight=height;resizeNineSlice(this.background,width,height);this.setSize(width,height);this.label.setFixedSize(Math.max(1,width-28),0).setOrigin(0.5);if(this.input?.hitArea&&"setTo"in this.input.hitArea&&typeof this.input.hitArea.setTo==="function")this.input.hitArea.setTo(0,0,width,height);this.layoutContent();return this;}
  override setInteractive(hitArea?:unknown,_callback?:Phaser.Types.Input.HitAreaCallback,_dropZone?:boolean):this{const rectangle=new Phaser.Geom.Rectangle(0,0,this.buttonWidth,this.buttonHeight);Phaser.GameObjects.Container.prototype.setInteractive.call(this,rectangle,Phaser.Geom.Rectangle.Contains);this.enabled=true;this.applyVisualState();if(typeof hitArea==="object"&&hitArea!==null&&"useHandCursor"in hitArea&&Boolean((hitArea as {useHandCursor?:unknown}).useHandCursor)&&this.input)this.input.cursor="pointer";return this;}
  override disableInteractive(resetCursor?:boolean):this{Phaser.GameObjects.Container.prototype.disableInteractive.call(this,resetCursor);this.enabled=false;this.hovered=false;this.pressed=false;this.applyVisualState();return this;}
  setEnabled(enabled:boolean):this{if(!enabled)return this.disableInteractive();this.enabled=true;if(this.input){this.input.enabled=true;this.input.cursor="pointer";}else this.setInteractive({useHandCursor:true});this.applyVisualState();return this;}
  setBaseFrame(frame:string):this{this.baseFrame=frame;this.applyVisualState();return this;}
  setLevelState(state:ButtonSemanticState):this{this.semanticState=state;this.baseFrame=this.frames[state]??this.frames.idle??UI_FRAMES.buttonIdle;if(state==="locked")this.disableInteractive();else this.applyVisualState();return this;}
  setIcon(frame:string|undefined,size=22,iconOnly=false):this{this.icon?.destroy();this.icon=frame?this.scene.add.image(0,0,frame).setDisplaySize(size,size):undefined;if(this.icon)this.addAt(this.icon,1);this.iconOnly=iconOnly;this.label.setVisible(!iconOnly);this.layoutContent();return this;}
  setCustomIcon(icon:PositionableIcon|undefined,iconOnly=true):this{this.icon?.destroy();this.icon=icon;if(icon)this.addAt(icon,1);this.iconOnly=iconOnly;this.label.setVisible(!iconOnly);this.layoutContent();return this;}
  layoutContent():this{if(!this.icon){this.label.setPosition(0,0);return this;}if(this.iconOnly||!this.label.text){this.icon.setPosition(0,0);return this;}const iconX=-this.buttonWidth/2+Math.min(30,this.buttonHeight*0.55);this.icon.setPosition(iconX,0);this.label.setPosition(Math.min(14,this.buttonHeight*0.22),0);return this;}
  setText(value:string):this{this.label.setText(value);this.layoutContent();return this;} setFontSize(value:number):this{this.label.setFontSize(value);return this;} setColor(value:string):this{this.label.setColor(value);return this;} setAlign(value:string):this{this.label.setAlign(value);return this;} setFontStyle(value:string):this{this.label.setFontStyle(value);return this;} setWordWrapWidth(value:number):this{this.label.setWordWrapWidth(value);return this;}
  setPadding(left?:number,top?:number,right?:number,bottom?:number):this{if(left===undefined){this.label.setPadding(0);return this;}if(top===undefined){this.label.setPadding(left);return this;}this.label.setPadding(left,top,right??left,bottom??top);return this;} setBackgroundColor(_value?:string):this{this.setBaseFrame(this.frames.selected??this.baseFrame);return this;}
}
export function makeButton(scene:Phaser.Scene,label:string,onClick:()=>void,size=16):AtlasButton{return new AtlasButton(scene,label,onClick,size);}
export function makeLevelButton(scene:Phaser.Scene,label:string,onClick:()=>void,size=12):AtlasButton{return new AtlasButton(scene,label,onClick,size,{level:true});}
export function makeIconButton(scene:Phaser.Scene,frame:string,onClick:()=>void,{size=48,glyphSize=Math.round(size*0.66)}:{size?:number;glyphSize?:number}={}):AtlasButton{return makeButton(scene,"",onClick,1).setIcon(frame,glyphSize,true).setFixedSize(size,size);}
export function makeCartIconButton(scene:Phaser.Scene,onClick:()=>void,{size=48}:{size?:number}={}):AtlasButton{const button=makeButton(scene,"",onClick,1).setFixedSize(size,size);const icon=scene.add.graphics();const scale=size/48;icon.lineStyle(Math.max(2,2.2*scale),0xe8edf2,1);icon.lineBetween(-12*scale,-10*scale,-8*scale,-10*scale);icon.lineBetween(-8*scale,-10*scale,-4*scale,6*scale);icon.strokeRoundedRect(-3*scale,-6*scale,17*scale,11*scale,2*scale);icon.fillStyle(0xe8edf2,1);icon.fillCircle(1*scale,10*scale,2.4*scale);icon.fillCircle(12*scale,10*scale,2.4*scale);return button.setCustomIcon(icon,true);}

export class CurrencyDisplay extends Phaser.GameObjects.Container{
  icon:Phaser.GameObjects.Image; valueText:Phaser.GameObjects.Text; #iconSize:number; #gap=7;
  constructor(scene:Phaser.Scene,frame:string,value=0,{iconSize=22,fontSize=14,color=THEME_COLORS.gold}:{iconSize?:number;fontSize?:number;color?:string}={}){const icon=scene.add.image(0,0,frame).setDisplaySize(iconSize,iconSize);const text=makeText(scene,"",fontSize,color).setOrigin(0,0.5).setFontStyle("bold");super(scene,0,0,[icon,text]);scene.add.existing(this);this.icon=icon;this.valueText=text;this.#iconSize=iconSize;this.setValue(value);}
  #layout():void{const totalWidth=this.#iconSize+this.#gap+this.valueText.width;this.icon.setPosition(-totalWidth/2+this.#iconSize/2,0);this.valueText.setPosition(-totalWidth/2+this.#iconSize+this.#gap,0);}
  setValue(next:number):this{this.valueText.setText(Math.round(next).toLocaleString("ru-RU"));this.#layout();return this;} setSignedValue(next:number):this{const rounded=Math.round(next);this.valueText.setText(rounded>0?`+${rounded.toLocaleString("ru-RU")}`:rounded.toLocaleString("ru-RU"));this.#layout();return this;} setFontSize(next:number):this{this.valueText.setFontSize(next);this.#layout();return this;}
}
export function makeCurrencyDisplay(scene:Phaser.Scene,frame:string,value=0,options:{iconSize?:number;fontSize?:number;color?:string}={}):CurrencyDisplay{return new CurrencyDisplay(scene,frame,value,options);}
export function setButtonEnabled(button:AtlasButton,enabled:boolean):void{button.setEnabled(enabled);}
