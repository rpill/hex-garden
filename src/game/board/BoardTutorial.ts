import Phaser from "phaser";
import type { HexCoord } from "../../hex.js";
import { makeText } from "../ui.js";

export interface TutorialGuideState {
  enabled: boolean;
  step: number;
  emptyRun: readonly HexCoord[];
  targets: readonly HexCoord[];
  visiblePieceKeys: ReadonlySet<string>;
  keyFor: (position: HexCoord) => string;
  toScreen: (position: HexCoord) => Readonly<{ x: number; y: number }>;
  hexSize: number;
}

export class BoardTutorial {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly text: Phaser.GameObjects.Text;
  readonly neighbourLabels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(8);
    this.text = makeText(scene, "", 13, "#c6ced8").setOrigin(0.5).setDepth(9);
  }

  setCopy(copy: string, visible: boolean): void {
    this.text.setText(copy).setVisible(visible);
    if (!visible) this.graphics.clear();
  }

  layout(x: number, y: number, fontSize: number, wrapWidth: number): void {
    this.text.setFontSize(fontSize).setPosition(x, y).setWordWrapWidth(wrapWidth);
  }

  renderGuide(state: TutorialGuideState): void {
    this.graphics.clear();
    if (!state.enabled) return;

    const drawGuideHex = (position: HexCoord, color: number, fillAlpha: number, lineAlpha: number): void => {
      const screen = state.toScreen(position);
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

    if (state.step === 0) {
      for (const position of state.emptyRun) drawGuideHex(position, 0x68cf75, 0.045, 0.28);
    }
    for (const position of state.targets) {
      if (!state.visiblePieceKeys.has(state.keyFor(position))) continue;
      drawGuideHex(position, 0xd9c66a, 0.035, 0.18);
    }
  }

  hideNeighbourLabels(): void {
    for (const label of this.neighbourLabels) label.setVisible(false);
  }

  destroy(): void {
    this.graphics.destroy();
    this.text.destroy();
    for (const label of this.neighbourLabels) label.destroy();
    this.neighbourLabels.length = 0;
  }
}
