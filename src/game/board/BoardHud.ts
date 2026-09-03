import type Phaser from "phaser";
import { GAMEPLAY_UI_FRAMES, UI_FRAMES } from "../../art-assets.js";
import {
  makeButton,
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
  onNext: () => void;
}

export interface BoardHudLabels {
  next: string;
}

export class BoardHud {
  readonly headerPanel: ReturnType<typeof makePanel>;
  readonly header: Phaser.GameObjects.Text;
  readonly status: Phaser.GameObjects.Text;
  readonly endless: Phaser.GameObjects.Text;
  readonly campaign: Phaser.GameObjects.Text;
  readonly dust: ReturnType<typeof makeCurrencyDisplay>;
  readonly nextButton: ReturnType<typeof makeButton>;
  readonly pauseButton: ReturnType<typeof makeIconButton>;
  readonly shopButton: ReturnType<typeof makeCartIconButton>;
  readonly settingsButton: ReturnType<typeof makeIconButton>;

  constructor(scene: Phaser.Scene, labels: BoardHudLabels, actions: BoardHudActions) {
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
    this.nextButton = makeButton(scene, labels.next, actions.onNext)
      .setIcon(GAMEPLAY_UI_FRAMES.next, 20)
      .setDepth(10)
      .setVisible(false)
      .disableInteractive();
    this.pauseButton = makeIconButton(scene, GAMEPLAY_UI_FRAMES.pause, actions.onPause, {
      size: 46,
      glyphSize: 32,
    }).setDepth(10);
    this.shopButton = makeCartIconButton(scene, actions.onShop, { size: 46 }).setDepth(10);
    this.settingsButton = makeIconButton(scene, GAMEPLAY_UI_FRAMES.settings, actions.onSettings, {
      size: 46,
      glyphSize: 32,
    }).setDepth(10);
  }

  setBusy(busy: boolean): void {
    this.pauseButton.setAlpha(1);
    this.nextButton.setAlpha(busy ? 0.45 : 1);
  }

  destroy(): void {
    for (const object of [
      this.headerPanel,
      this.header,
      this.status,
      this.endless,
      this.campaign,
      this.dust,
      this.nextButton,
      this.pauseButton,
      this.shopButton,
      this.settingsButton,
    ]) {
      object.destroy();
    }
  }
}
