import Phaser from "phaser";
import type { HexCoord } from "../../hex.js";
import { makeMinimalText } from "../minimal-ui.js";
import {
  chooseCalloutPlacement,
  type CalloutSide,
  type RectBounds,
} from "../tutorial-callout-layout.js";

export interface TutorialGuideState {
  enabled: boolean;
  step: number;
  copy: string;
  emptyRun: readonly HexCoord[];
  targets: readonly HexCoord[];
  visiblePieceKeys: ReadonlySet<string>;
  keyFor: (position: HexCoord) => string;
  toScreen: (position: HexCoord) => Readonly<{ x: number; y: number }>;
  hexSize: number;
  viewport: Readonly<{ width: number; height: number }>;
  targetBounds?: RectBounds;
  preferredSides?: readonly CalloutSide[];
}

export class BoardTutorial {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly calloutGraphics: Phaser.GameObjects.Graphics;
  readonly text: Phaser.GameObjects.Text;
  readonly neighbourLabels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(8);
    this.calloutGraphics = scene.add.graphics().setDepth(8.5);
    this.text = makeMinimalText(scene, "", 13, "#dfe6ee").setOrigin(0.5).setDepth(9).setVisible(false);
  }

  renderGuide(state: TutorialGuideState): void {
    this.graphics.clear();
    this.calloutGraphics.clear();
    this.text.setVisible(false);
    if (!state.enabled) return;

    const markerScreens: { x: number; y: number }[] = [];
    const drawGuideHex = (position: HexCoord, color: number, fillAlpha: number, lineAlpha: number): void => {
      const screen = state.toScreen(position);
      markerScreens.push(screen);
      const points: Phaser.Geom.Point[] = [];
      for (let corner = 0; corner < 6; corner += 1) {
        const angle = Phaser.Math.DegToRad(60 * corner - 30);
        points.push(
          new Phaser.Geom.Point(
            screen.x + state.hexSize * 0.82 * Math.cos(angle),
            screen.y + state.hexSize * 0.82 * Math.sin(angle),
          ),
        );
      }
      this.graphics.fillStyle(color, fillAlpha).fillPoints(points, true);
      this.graphics.lineStyle(1, color, lineAlpha).strokePoints(points, true);
    };

    if (state.step === 1) {
      for (const position of state.emptyRun) drawGuideHex(position, 0x68cf75, 0.055, 0.34);
    }
    for (const position of state.targets) {
      if (!state.visiblePieceKeys.has(state.keyFor(position))) continue;
      drawGuideHex(position, 0xd9c66a, 0.035, 0.18);
    }

    const pad = state.hexSize * 0.9;
    const targetBounds: RectBounds | undefined = state.targetBounds ?? (
      markerScreens.length > 0
        ? {
            left: Math.min(...markerScreens.map((screen) => screen.x)) - pad,
            right: Math.max(...markerScreens.map((screen) => screen.x)) + pad,
            top: Math.min(...markerScreens.map((screen) => screen.y)) - pad,
            bottom: Math.max(...markerScreens.map((screen) => screen.y)) + pad,
          }
        : undefined
    );
    if (!targetBounds) return;

    if (state.targetBounds) {
      const width = Math.max(1, targetBounds.right - targetBounds.left);
      const height = Math.max(1, targetBounds.bottom - targetBounds.top);
      this.graphics
        .lineStyle(2, 0xd9c66a, 0.42)
        .strokeRoundedRect(targetBounds.left, targetBounds.top, width, height, 10);
    }
    const calloutWidth = Math.min(300, Math.max(210, state.viewport.width - 32));
    const calloutHeight = 66;
    const placement = chooseCalloutPlacement({
      targetBounds,
      viewport: state.viewport,
      callout: { width: calloutWidth, height: calloutHeight },
      ...(state.preferredSides ? { preferredSides: state.preferredSides } : {}),
    });

    this.calloutGraphics
      .fillStyle(0x141a22, 0.94)
      .fillRoundedRect(
        placement.x - calloutWidth / 2,
        placement.y - calloutHeight / 2,
        calloutWidth,
        calloutHeight,
        10,
      )
      .lineStyle(1, 0x506071, 0.75)
      .strokeRoundedRect(
        placement.x - calloutWidth / 2,
        placement.y - calloutHeight / 2,
        calloutWidth,
        calloutHeight,
        10,
      );

    this.text
      .setText(state.copy)
      .setFontSize(state.viewport.width < 560 ? 11 : 13)
      .setWordWrapWidth(calloutWidth - 26)
      .setPosition(placement.x, placement.y)
      .setVisible(true);
  }

  hideNeighbourLabels(): void {
    for (const label of this.neighbourLabels) label.setVisible(false);
  }

  destroy(): void {
    this.graphics.destroy();
    this.calloutGraphics.destroy();
    this.text.destroy();
    for (const label of this.neighbourLabels) label.destroy();
    this.neighbourLabels.length = 0;
  }
}
