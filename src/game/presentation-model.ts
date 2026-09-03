import type { EconomySnapshot, HintProduct, HintTypeValue } from "../economy.js";

export const GlobalAction = Object.freeze({ BACK: "back", PAUSE: "pause", SHOP: "shop", SETTINGS: "settings" } as const);
export type GlobalActionValue = (typeof GlobalAction)[keyof typeof GlobalAction];
export type UtilitySceneKey = "board" | "shop" | "settings" | "level-select" | "leaderboard" | "menu";

export interface GlobalActionPresentation { label:string; iconOnly:boolean; }
export function globalActionPresentation(action:GlobalActionValue,english=false):Readonly<GlobalActionPresentation>{
  if(action===GlobalAction.BACK)return Object.freeze({label:english?"BACK":"НАЗАД",iconOnly:false});
  if(action===GlobalAction.PAUSE||action===GlobalAction.SHOP||action===GlobalAction.SETTINGS)return Object.freeze({label:"",iconOnly:true});
  return assertNever(action);
}
function assertNever(value:never):never{throw new Error(`Unknown global action: ${String(value)}`);}
export function currencyPresentation(value:number,{signed=false}:{signed?:boolean}={}):Readonly<{value:number;text:string}>{
  const rounded=Math.round(value); const formatted=rounded.toLocaleString("ru-RU"); return Object.freeze({value:rounded,text:signed&&rounded>0?`+${formatted}`:formatted});
}
export interface ShopProductPresentation { id:string; hint:HintTypeValue; title:string; description:string; amount:number; price:number; owned:number; affordable:boolean; buyLabel:string; }
export function shopProductPresentation(product:HintProduct,snapshot:EconomySnapshot,english=false):Readonly<ShopProductPresentation>{
  return Object.freeze({id:product.id,hint:product.hint,title:english?product.titleEn:product.title,description:english?product.descriptionEn:product.description,amount:product.amount,price:product.price,owned:snapshot.hints[product.hint],affordable:snapshot.dust>=product.price,buyLabel:english?"BUY":"КУПИТЬ"});
}
export type ButtonSemanticState="idle"|"locked"|"disabled"|"current"|"completed"|string;
export interface ButtonVisualOptions { semanticState?:ButtonSemanticState; hovered?:boolean; pressed?:boolean; enabled?:boolean; }
export function buttonVisualState({semanticState="idle",hovered=false,pressed=false,enabled=true}:ButtonVisualOptions={}):Readonly<{semanticState:ButtonSemanticState;hovered:boolean;pressed:boolean;enabled:boolean;scale:number;alpha:number}>{
  const disabled=!enabled||semanticState==="locked"||semanticState==="disabled"; const scale=disabled?1:pressed?0.99:hovered?1.018:1; const alpha=disabled?0.58:hovered?1:0.96;
  return Object.freeze({semanticState,hovered,pressed,enabled:!disabled,scale,alpha});
}
export type GlobalActionIconSemantic="cart"|"settings"|"pause"|"back";
export function globalActionIconSemantic(action:GlobalActionValue):GlobalActionIconSemantic{
  if(action===GlobalAction.SHOP)return "cart"; if(action===GlobalAction.SETTINGS)return "settings"; if(action===GlobalAction.PAUSE)return "pause"; if(action===GlobalAction.BACK)return "back"; return assertNever(action);
}
export interface TutorialPresentationStep { header:string; copy:string; }
export function tutorialPresentationStep(step:number,english=false):Readonly<TutorialPresentationStep>{
  const copyRu=["Фишка доступна, если рядом открыты три клетки подряд.","Выберите две доступные фишки одного типа.","Открыв новые клетки, очистите оставшиеся пары."] as const;
  const copyEn=["A piece is available when three neighbouring cells are open in a row.","Select two available pieces of the same type.","Open new cells and clear the remaining pairs."] as const;
  if(!Number.isInteger(step)||step<0||step>=3)throw new RangeError(`Unknown tutorial presentation step: ${step}`);
  const copy=(english?copyEn:copyRu)[step]; if(copy===undefined)throw new RangeError(`Unknown tutorial presentation step: ${step}`);
  return Object.freeze({header:english?`TUTORIAL · STEP ${step+1}/3`:`ОБУЧЕНИЕ · ШАГ ${step+1}/3`,copy});
}
export type UtilityReturnPlan=Readonly<{kind:"resume"|"start";scene:UtilitySceneKey}>;
export function utilityReturnPlan(returnScene:string|undefined):UtilityReturnPlan{
  if(returnScene==="board"||returnScene==="shop"||returnScene==="settings")return Object.freeze({kind:"resume",scene:returnScene});
  if(returnScene==="level-select"||returnScene==="leaderboard"||returnScene==="menu")return Object.freeze({kind:"start",scene:returnScene});
  return Object.freeze({kind:"start",scene:"menu"});
}
