export const GlobalAction = Object.freeze({ BACK: "back", PAUSE: "pause", SETTINGS: "settings" } as const);
export type GlobalActionValue = (typeof GlobalAction)[keyof typeof GlobalAction];
export type UtilityRootSceneKey = "board" | "level-select" | "menu";
export type UtilitySceneKey = UtilityRootSceneKey | "settings" | "rules";

export interface GlobalActionPresentation { label:string; iconOnly:boolean; }
export function globalActionPresentation(action:GlobalActionValue,english=false):Readonly<GlobalActionPresentation>{
  if(action===GlobalAction.BACK)return Object.freeze({label:english?"BACK":"НАЗАД",iconOnly:false});
  if(action===GlobalAction.PAUSE||action===GlobalAction.SETTINGS)return Object.freeze({label:"",iconOnly:true});
  return assertNever(action);
}
function assertNever(value:never):never{throw new Error(`Unknown global action: ${String(value)}`);}
export function currencyPresentation(value:number,{signed=false}:{signed?:boolean}={}):Readonly<{value:number;text:string}>{
  const rounded=Math.round(value); const formatted=rounded.toLocaleString("ru-RU"); return Object.freeze({value:rounded,text:signed&&rounded>0?`+${formatted}`:formatted});
}
export type ButtonSemanticState="idle"|"locked"|"disabled"|"current"|"completed"|string;
export interface ButtonVisualOptions { semanticState?:ButtonSemanticState; hovered?:boolean; pressed?:boolean; enabled?:boolean; }
export function buttonVisualState({semanticState="idle",hovered=false,pressed=false,enabled=true}:ButtonVisualOptions={}):Readonly<{semanticState:ButtonSemanticState;hovered:boolean;pressed:boolean;enabled:boolean;scale:number;alpha:number}>{
  const disabled=!enabled||semanticState==="locked"||semanticState==="disabled"; const scale=disabled?1:pressed?0.99:hovered?1.018:1; const alpha=disabled?0.58:hovered?1:0.96;
  return Object.freeze({semanticState,hovered,pressed,enabled:!disabled,scale,alpha});
}
export type GlobalActionIconSemantic="settings"|"pause"|"back";
export function globalActionIconSemantic(action:GlobalActionValue):GlobalActionIconSemantic{
  if(action===GlobalAction.SETTINGS)return "settings"; if(action===GlobalAction.PAUSE)return "pause"; if(action===GlobalAction.BACK)return "back"; return assertNever(action);
}
export interface TutorialPresentationStep { copy:string; }
export function tutorialPresentationStep(step:number,english=false):Readonly<TutorialPresentationStep>{
  const copyRu=[
    "Очисти поле: выбери две одинаковые доступные фишки.",
    "Три пустые клетки подряд делают фишку доступной.",
    "Здесь видно, сколько фишек каждого типа осталось.",
  ] as const;
  const copyEn=[
    "Clear the board: choose two matching available pieces.",
    "Three empty cells in a row make a piece available.",
    "This panel shows how many pieces of each type remain.",
  ] as const;
  if(!Number.isInteger(step)||step<0||step>=3)throw new RangeError(`Unknown tutorial presentation step: ${step}`);
  const copy=(english?copyEn:copyRu)[step];
  if(copy===undefined)throw new RangeError(`Unknown tutorial presentation step: ${step}`);
  return Object.freeze({copy});
}
export type UtilityReturnPlan=Readonly<{kind:"resume"|"start";scene:UtilityRootSceneKey}>;
export function utilityReturnPlan(returnScene:string|undefined):UtilityReturnPlan{
  if(returnScene==="board")return Object.freeze({kind:"resume",scene:returnScene});
  if(returnScene==="level-select"||returnScene==="menu")return Object.freeze({kind:"start",scene:returnScene});
  return Object.freeze({kind:"start",scene:"menu"});
}
