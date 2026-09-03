import type Phaser from "phaser";
import { GAMEPLAY_UI_FRAMES, UI_FRAMES } from "../../art-assets.js";
import {
  makeCartIconButton,
  makeCurrencyDisplay,
  makeIconButton,
  makePanel,
  makeText,
} from "../ui.js";

export interface BoardHudActions {
  onPause: () => void;
  onShop: () => void;
  onSettings: () => void;
  onRestart: () => void;
}

export class BoardHud {
  readonly headerPanel: ReturnType<typeof makePanel>;
  readonly header: Phaser.GameObjects.Text;
  readonly status: Phaser.GameObjects.Text;
  readonly endless: Phaser.GameObjects.Text;
  readonly campaign: Phaser.GameObjects.Text;
  readonly dust: ReturnType<typeof makeCurrencyDisplay>;
  readonly pauseButton: ReturnType<typeof makeIconButton>;
  readonly shopButton: ReturnType<typeof makeCartIconButton>;
  readonly settingsButton: ReturnType<typeof makeIconButton>;
  readonly restartButton: ReturnType<typeof makeIconButton>;

  constructor(scene: Phaser.Scene, actions: BoardHudActions) {
    this.headerPanel = makePanel(scene, UI_FRAMES.panelStripSmall, 9);
    this.header = makeText(scene, "", 16, "#eef3f8").setOrigin(0.5).setDepth(10);
    this.status = makeText(scene, "", 14, "#9aa7b5").setOrigin(0.5).setDepth(10);
    this.endless = makeText(scene, "", 13, "#f3c94f").setOrigin(0.5).setDepth(10);
    this.campaign = makeText(scene, "", 13, "#77dc91").setOrigin(0.5).setDepth(10);
    this.dust = makeCurrencyDisplay(scene, GAMEPLAY_UI_FRAMES.dust, 0, {
      iconSize: 22,
      fontSize: 12,
      color: "#f3c94f",
    }).setDepth(10);
    this.pauseButton = makeIconButton(scene, GAMEPLAY_UI_FRAMES.pause, actions.onPause, {
      size: 46,
      glyphSize: 32,
    }).setDepth(10);
    this.shopButton = makeCartIconButton(scene, actions.onShop, { size: 46 }).setDepth(10);
    this.settingsButton = makeIconButton(scene, GAMEPLAY_UI_FRAMES.settings, actions.onSettings, {
      size: 46,
      glyphSize: 32,
    }).setDepth(10);
    this.restartButton = makeIconButton(
      scene,
      GAMEPLAY_UI_FRAMES.retry,
      actions.onRestart,
      { size: 42, glyphSize: 26 },
    ).setDepth(10);
  }

  setBusy(busy: boolean): void {
    this.pauseButton.setAlpha(1);
    this.restartButton.setAlpha(busy ? 0.45 : 1);
  }

  setRestartEmphasis(actualDeadEnd: boolean): void {
    this.restartButton.setAlpha(actualDeadEnd ? 1 : 0.72);
  }

  destroy(): void {
    for (const object of [
      this.headerPanel,
      this.header,
      this.status,
      this.endless,
      this.campaign,
      this.dust,
      this.pauseButton,
      this.shopButton,
      this.settingsButton,
      this.restartButton,
    ]) {
      object.destroy();
    }
  }
}
