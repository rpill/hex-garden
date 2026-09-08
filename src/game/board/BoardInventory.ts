import Phaser from "phaser";
import {
  ACTIVE_ART_THEME,
  GAMEPLAY_UI_FRAMES,
  PHYSICAL_MATERIAL_FRAMES,
  THEME_COLORS,
  UI_FRAMES,
  physicalPieceFrameForType,
} from "../../art-assets.js";
import { Atom, type AtomType } from "../../atom-types.js";
import { PHYSICAL_PIECE_UI_CANVAS_SCALE } from "../physical-asset-layout.js";
import { HintType, type HintTypeValue } from "../../economy.js";
import { PANEL_METAL_TYPES, type PanelState } from "../../panel-state.js";
import { makeButton, makePanel, makeText, resizeNineSlice } from "../ui.js";
import { inventoryCountOffset } from "../presentation-layout.js";

const ACTIVE_COUNT_COLOR = "#f3ead8";

export interface BoardInventoryActions {
  onSelectType: (type: AtomType) => void;
  onHint: (type: HintTypeValue) => void;
}

export interface BoardInventoryPresentation {
  labelForType: (type: AtomType) => string;
  colorForType: (type: AtomType) => number;
  glyphFrameForType: (type: AtomType) => string | undefined;
}

export interface BoardInventoryRevealState {
  revealedCounts: ReadonlyMap<AtomType, number>;
  activationProgress: ReadonlyMap<AtomType, number>;
}

export interface BoardInventoryEntryLayout {
  type: AtomType;
  row: number;
  column: number;
  x: number;
  y: number;
}

export interface BoardInventoryLayout {
  left: number;
  width: number;
  top: number;
  height: number;
  radius: number;
  step: number;
  rows: number;
  entries: BoardInventoryEntryLayout[];
  types: AtomType[];
}

type PanelView = {
  type: AtomType;
  tokenBase?: Phaser.GameObjects.Image;
  glyph?: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
  lastIntroCount?: number;
  lastRenderedCount?: number;
};

export class BoardInventory {
  readonly panel: ReturnType<typeof makePanel>;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly hintButtons: Map<HintTypeValue, ReturnType<typeof makeButton>>;
  readonly views = new Map<AtomType, PanelView>();
  layoutState: BoardInventoryLayout | undefined;

  readonly #scene: Phaser.Scene;
  readonly #actions: BoardInventoryActions;
  readonly #presentation: BoardInventoryPresentation;

  constructor(scene: Phaser.Scene, actions: BoardInventoryActions, presentation: BoardInventoryPresentation) {
    this.#scene = scene;
    this.#actions = actions;
    this.#presentation = presentation;
    this.panel = makePanel(scene, UI_FRAMES.panelSide, 3).setMaterialRole("walnut-tray");
    this.graphics = scene.add.graphics().setDepth(4);
    this.hintButtons = new Map<HintTypeValue, ReturnType<typeof makeButton>>([
      [HintType.MOVE, makeButton(scene, "ХОД +", () => actions.onHint(HintType.MOVE)).setIcon(GAMEPLAY_UI_FRAMES.hint, 20).setDepth(10)],
      [HintType.UNDO, makeButton(scene, "ОТМЕНА +", () => actions.onHint(HintType.UNDO)).setIcon(GAMEPLAY_UI_FRAMES.undo, 20).setDepth(10)],
      [HintType.RESCUE, makeButton(scene, "СПАСТИ +", () => actions.onHint(HintType.RESCUE)).setIcon(GAMEPLAY_UI_FRAMES.rescue, 20).setDepth(10)],
    ]);
  }

  rebuild(types: readonly AtomType[]): void {
    this.clearViews();
    this.layoutState = undefined;
    for (const type of types) {
      const glyphFrame = this.#presentation.glyphFrameForType(type);
      const premiumPieceFrame = physicalPieceFrameForType(type);
      const premiumFallbackBall =
        ACTIVE_ART_THEME === "premium" && this.#scene.textures.exists(PHYSICAL_MATERIAL_FRAMES.pieceBall);
      const tokenFrame = premiumPieceFrame && this.#scene.textures.exists(premiumPieceFrame)
        ? premiumPieceFrame
        : premiumFallbackBall
        ? PHYSICAL_MATERIAL_FRAMES.pieceBall
        : undefined;
      const tokenBase = tokenFrame
        ? this.#scene.add
            .image(0, 0, tokenFrame)
            .setDepth(5)
        : undefined;
      const activeGlyphFrame = ACTIVE_ART_THEME === "premium" ? undefined : glyphFrame;
      const glyph = activeGlyphFrame && this.#scene.textures.exists(activeGlyphFrame)
        ? this.#scene.add.image(0, 0, activeGlyphFrame).setDepth(6)
        : undefined;
      const label = premiumPieceFrame || glyph
        ? undefined
        : makeText(
            this.#scene,
            this.#presentation.labelForType(type),
            14,
            ACTIVE_ART_THEME === "premium" ? THEME_COLORS.ink : THEME_COLORS.text,
          )
            .setOrigin(0.5)
            .setFontStyle("bold")
            .setDepth(6);
      const count = makeText(this.#scene, "", 10, THEME_COLORS.ivory === THEME_COLORS.chrome ? THEME_COLORS.text : "#f5eedc")
        .setOrigin(0.5)
        .setFontStyle("bold")
        .setDepth(6);
      const hitZone = this.#scene.add.zone(0, 0, 36, 36).setDepth(7);
      hitZone.setInteractive(
        new Phaser.Geom.Circle(18, 18, 18),
        Phaser.Geom.Circle.Contains,
      );
      if (hitZone.input) hitZone.input.cursor = "pointer";
      hitZone.on("pointerdown", () => this.#actions.onSelectType(type));
      this.views.set(type, {
        type,
        ...(tokenBase ? { tokenBase } : {}),
        ...(glyph ? { glyph } : {}),
        ...(label ? { label } : {}),
        count,
        hitZone,
      });
    }
  }

  layout(contentLeft: number, contentWidth: number, height: number, compact: boolean, types: readonly AtomType[]): BoardInventoryLayout | undefined {
    if (types.length === 0) {
      this.layoutState = undefined;
      this.graphics.clear();
      this.panel.setVisible(false);
      return undefined;
    }
    const useTwoRows = compact && types.length > 9;
    const columns = useTwoRows ? Math.ceil(types.length / 2) : types.length;
    const rows = Math.ceil(types.length / columns);
    const desiredWidth = columns * (compact ? 50 : 60);
    const panelWidth = Math.min(contentWidth - 16, compact ? 560 : 820, Math.max(116, desiredWidth));
    const left = contentLeft + (contentWidth - panelWidth) / 2;
    const step = panelWidth / columns;
    const radius = Math.max(13, Math.min(compact ? 19 : 22, step * 0.36));
    const rowHeight = Math.max(38, radius * 2 + 8);
    const panelHeight = rows * rowHeight + 16;
    const top = height - panelHeight - 8;
    const entries: BoardInventoryEntryLayout[] = types.map((type, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const rowCount = Math.min(columns, types.length - row * columns);
      const rowWidth = step * rowCount;
      const rowLeft = contentLeft + (contentWidth - rowWidth) / 2;
      return { type, row, column, x: rowLeft + step * (column + 0.5), y: top + 8 + rowHeight * (row + 0.5) };
    });
    const layout: BoardInventoryLayout = {
      left,
      width: panelWidth,
      top,
      height: panelHeight,
      radius,
      step,
      rows,
      entries,
      types: [...types],
    };
    this.layoutState = layout;
    resizeNineSlice(this.panel, panelWidth, panelHeight);
    this.panel.setPosition(left + panelWidth / 2, top + panelHeight / 2).setVisible(true);
    for (const { type, x, y } of entries) {
      const view = this.views.get(type);
      if (!view) continue;
      const hitDiameter = Math.max(40, radius * 2.25);
      view.tokenBase?.setPosition(x, y).setDisplaySize(
        radius * 2.12 * PHYSICAL_PIECE_UI_CANVAS_SCALE,
        radius * 2.12 * PHYSICAL_PIECE_UI_CANVAS_SCALE,
      );
      view.label?.setPosition(x, y).setFontSize(Math.max(10, Math.floor(radius * 0.78)));
      view.glyph?.setPosition(x, y - radius * 0.03).setDisplaySize(radius * 1.34, radius * 1.34);
      const countOffset = inventoryCountOffset(radius);
      view.count.setPosition(x + countOffset.x, y + countOffset.y).setFontSize(Math.max(11, Math.floor(radius * 0.68)));
      view.hitZone.setPosition(x, y).setSize(hitDiameter, hitDiameter);
      view.hitZone.input?.hitArea?.setTo?.(hitDiameter / 2, hitDiameter / 2, hitDiameter / 2);
    }
    return layout;
  }

  reposition(top: number): void {
    const layout = this.layoutState;
    if (!layout) return;
    const delta = top - layout.top;
    if (Math.abs(delta) < 0.5) return;
    layout.top = top;
    for (const entry of layout.entries) entry.y += delta;
    this.panel.setPosition(layout.left + layout.width / 2, top + layout.height / 2);
    for (const entry of layout.entries) {
      const view = this.views.get(entry.type);
      if (!view) continue;
      view.tokenBase?.setPosition(entry.x, entry.y);
      view.label?.setPosition(entry.x, entry.y);
      view.glyph?.setPosition(entry.x, entry.y - layout.radius * 0.03);
      const countOffset = inventoryCountOffset(layout.radius);
      view.count.setPosition(entry.x + countOffset.x, entry.y + countOffset.y);
      view.hitZone.setPosition(entry.x, entry.y);
    }
  }

  setPresentationVisible(visible: boolean, controlsEnabled = visible): void {
    this.panel.setVisible(visible && this.layoutState !== undefined);
    this.graphics.setVisible(visible);
    for (const view of this.views.values()) {
      view.tokenBase?.setVisible(visible);
      view.glyph?.setVisible(visible);
      view.label?.setVisible(visible);
      view.count.setVisible(visible);
      view.hitZone.setVisible(visible);
      if (visible && controlsEnabled) {
        view.hitZone.setInteractive({ useHandCursor: true });
      } else {
        view.hitZone.disableInteractive();
      }
    }
    if (!visible) {
      for (const button of this.hintButtons.values()) {
        button.setVisible(false).disableInteractive();
      }
    } else if (!controlsEnabled) {
      for (const button of this.hintButtons.values()) {
        button.setAlpha(0.42);
        button.disableInteractive();
      }
    }
  }

  render(
    state: Readonly<PanelState>,
    reveal?: Readonly<BoardInventoryRevealState>,
  ): void {
    this.graphics.clear();
    const layout = this.layoutState;
    if (!layout) return;
    const { radius, entries, types } = layout;
    const saltIndex = types.indexOf(Atom.SALT);
    const oppositeStartIndex = types.findIndex((type) => type === Atom.VITAE || type === Atom.MORS);
    const quicksilverIndex = types.indexOf(Atom.QUICKSILVER);
    const metalStartIndex = types.findIndex((type) => PANEL_METAL_TYPES.includes(type as (typeof PANEL_METAL_TYPES)[number]));
    const boundaries = new Set([
      saltIndex >= 0 && saltIndex < types.length - 1 ? saltIndex + 1 : -1,
      oppositeStartIndex > 0 ? oppositeStartIndex : -1,
      quicksilverIndex > 0 ? quicksilverIndex : -1,
      metalStartIndex > 0 ? metalStartIndex : -1,
    ]);
    for (const boundary of boundaries) {
      if (boundary <= 0 || boundary >= types.length) continue;
      const before = entries[boundary - 1];
      const after = entries[boundary];
      if (!before || !after || before.row !== after.row) continue;
      const x = (before.x + after.x) / 2;
      this.graphics.lineStyle(1, THEME_COLORS.brassSoft, 0.42);
      this.graphics.lineBetween(x, before.y - radius, x, before.y + radius);
    }
    for (let index = 0; index < types.length - 1; index += 1) {
      const current = types[index];
      const next = types[index + 1];
      if (current === undefined || next === undefined) continue;
      if (!PANEL_METAL_TYPES.includes(current as (typeof PANEL_METAL_TYPES)[number]) || !PANEL_METAL_TYPES.includes(next as (typeof PANEL_METAL_TYPES)[number])) continue;
      const from = entries[index];
      const to = entries[index + 1];
      if (!from || !to || from.row !== to.row) continue;
      const fromX = from.x + radius + 2;
      const toX = to.x - radius - 2;
      if (toX <= fromX) continue;
      this.graphics.lineStyle(1, THEME_COLORS.brassSoft, 0.42);
      this.graphics.lineBetween(fromX, from.y, toX, to.y);
      this.graphics.fillStyle(THEME_COLORS.brassSoft, 0.42);
      this.graphics.fillTriangle(toX, to.y, toX - 4, to.y - 3, toX - 4, to.y + 3);
    }
    state.entries.forEach((entry, index) => {
      const view = this.views.get(entry.type);
      const position = entries[index];
      if (!view || !position) return;
      const { x, y } = position;
      const baseAlpha = entry.depleted ? 0.18 : entry.locked ? 0.36 : 1;
      const revealedCount = reveal?.revealedCounts.get(entry.type) ?? entry.count;
      const activationProgress = reveal
        ? Math.max(0, Math.min(1, reveal.activationProgress.get(entry.type) ?? 0))
        : 1;
      const revealed = reveal === undefined || revealedCount > 0;
      const easedActivation = 1 - Math.pow(1 - activationProgress, 3);
      const revealAlpha = reveal
        ? revealed
          ? 0.22 + easedActivation * 0.78
          : 0.22
        : 1;
      const revealScale = reveal
        ? revealed
          ? 0.88 + easedActivation * 0.12
          : 0.88
        : 1;
      const alpha = baseAlpha * revealAlpha;
      const displayRadius = radius * revealScale;

      if (!view.glyph && !view.tokenBase) {
        this.graphics.fillStyle(this.#presentation.colorForType(entry.type), alpha);
        this.graphics.fillCircle(x, y, displayRadius);
      }
      if (entry.selected || entry.current || (!view.glyph && !view.tokenBase)) {
        this.graphics.lineStyle(
          entry.selected ? 3 : entry.current ? 2 : 1,
          entry.selected ? 0xffffff : entry.current ? 0xf3c94f : 0x101010,
          alpha,
        );
        this.graphics.strokeCircle(x, y, displayRadius * (view.tokenBase ? 1.05 : 1));
      }
      view.tokenBase
        ?.setAlpha(alpha * 0.96)
        .setDisplaySize(
          radius * 2.12 * PHYSICAL_PIECE_UI_CANVAS_SCALE * revealScale,
          radius * 2.12 * PHYSICAL_PIECE_UI_CANVAS_SCALE * revealScale,
        );
      view.glyph
        ?.setAlpha(alpha)
        .setDisplaySize(radius * 1.34 * revealScale, radius * 1.34 * revealScale);
      view.label?.setAlpha(alpha).setScale(revealScale);

      if (reveal) {
        if (view.lastIntroCount !== revealedCount) {
          const previousCount = view.lastIntroCount ?? 0;
          view.lastIntroCount = revealedCount;
          this.#scene.tweens.killTweensOf(view.count);
          if (revealedCount > 0) {
            view.count.setScale(previousCount === 0 ? 0.82 : 1.16);
            this.#scene.tweens.add({
              targets: view.count,
              scale: 1,
              duration: previousCount === 0 ? 180 : 130,
              ease: "Cubic.Out",
            });
          } else {
            view.count.setScale(1);
          }
        }
      } else {
        if (view.lastIntroCount !== undefined) {
          this.#scene.tweens.killTweensOf(view.count);
          delete view.lastIntroCount;
          view.count.setScale(1);
        }
        const previousCount = view.lastRenderedCount;
        if (previousCount !== undefined && entry.count < previousCount) {
          this.#scene.tweens.killTweensOf(view.count);
          view.count.setScale(1.16);
          this.#scene.tweens.add({
            targets: view.count,
            scale: 1,
            duration: 150,
            ease: "Cubic.Out",
          });
          if (view.glyph) {
            this.#scene.tweens.killTweensOf(view.glyph);
            view.glyph.setScale(view.glyph.scaleX * 1.06, view.glyph.scaleY * 1.06);
            this.#scene.tweens.add({
              targets: view.glyph,
              scaleX: view.glyph.scaleX / 1.06,
              scaleY: view.glyph.scaleY / 1.06,
              duration: 170,
              ease: "Cubic.Out",
            });
          }
        }
        view.lastRenderedCount = entry.count;
      }

      const countText = reveal
        ? entry.countVisible && revealedCount > 0
          ? `×${revealedCount}`
          : ""
        : entry.countVisible && !entry.depleted
        ? `×${entry.count}`
        : "";
      const countAlpha = reveal && revealed
        ? alpha * (0.55 + easedActivation * 0.45)
        : reveal
        ? 0
        : alpha;
      view.count
        .setText(countText)
        .setColor(entry.warning ? THEME_COLORS.danger : ACTIVE_COUNT_COLOR)
        .setAlpha(countAlpha);
    });
  }

  clearViews(): void {
    for (const view of this.views.values()) {
      view.tokenBase?.destroy();
      view.glyph?.destroy();
      view.label?.destroy();
      view.count.destroy();
      view.hitZone.destroy();
    }
    this.views.clear();
  }

  destroy(): void {
    this.clearViews();
    this.panel.destroy();
    this.graphics.destroy();
    for (const button of this.hintButtons.values()) button.destroy();
    this.hintButtons.clear();
  }
}
