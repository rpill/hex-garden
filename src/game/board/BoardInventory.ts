import Phaser from "phaser";
import { GAMEPLAY_UI_FRAMES, UI_FRAMES } from "../../art-assets.js";
import { Atom, type AtomType } from "../../atom-types.js";
import { HintType, type HintTypeValue } from "../../economy.js";
import { PANEL_METAL_TYPES, type PanelState } from "../../panel-state.js";
import { makeButton, makePanel, makeText, resizeNineSlice } from "../ui.js";
import { inventoryCountOffset } from "../presentation-layout.js";

export interface BoardInventoryActions {
  onSelectType: (type: AtomType) => void;
  onHint: (type: HintTypeValue) => void;
}

export interface BoardInventoryPresentation {
  labelForType: (type: AtomType) => string;
  colorForType: (type: AtomType) => number;
  glyphFrameForType: (type: AtomType) => string | undefined;
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
  glyph?: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
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
    this.panel = makePanel(scene, UI_FRAMES.panelSide, 3);
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
      const glyph = glyphFrame && this.#scene.textures.exists(glyphFrame)
        ? this.#scene.add.image(0, 0, glyphFrame).setDepth(6)
        : undefined;
      const label = glyph
        ? undefined
        : makeText(this.#scene, this.#presentation.labelForType(type), 14, "#eef3f8")
            .setOrigin(0.5)
            .setDepth(6);
      const count = makeText(this.#scene, "", 10, "#eef3f8")
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
      this.views.set(type, { type, ...(glyph ? { glyph } : {}), ...(label ? { label } : {}), count, hitZone });
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
    const desiredWidth = columns * (compact ? 48 : 54);
    const panelWidth = Math.min(contentWidth - 16, compact ? 560 : 820, Math.max(116, desiredWidth));
    const left = contentLeft + (contentWidth - panelWidth) / 2;
    const step = panelWidth / columns;
    const radius = Math.max(12, Math.min(compact ? 18 : 20, step * 0.34));
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
      view.label?.setPosition(x, y).setFontSize(Math.max(10, Math.floor(radius * 0.78)));
      view.glyph?.setPosition(x, y).setDisplaySize(radius * 1.7, radius * 1.7);
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
      view.label?.setPosition(entry.x, entry.y);
      view.glyph?.setPosition(entry.x, entry.y);
      const countOffset = inventoryCountOffset(layout.radius);
      view.count.setPosition(entry.x + countOffset.x, entry.y + countOffset.y);
      view.hitZone.setPosition(entry.x, entry.y);
    }
  }

  setPresentationVisible(visible: boolean): void {
    this.panel.setVisible(visible && this.layoutState !== undefined);
    this.graphics.setVisible(visible);
    for (const view of this.views.values()) {
      view.glyph?.setVisible(visible);
      view.label?.setVisible(visible);
      view.count.setVisible(visible);
      view.hitZone.setVisible(visible);
      if (visible) {
        view.hitZone.setInteractive({ useHandCursor: true });
      } else {
        view.hitZone.disableInteractive();
      }
    }
    if (!visible) {
      for (const button of this.hintButtons.values()) {
        button.setVisible(false).disableInteractive();
      }
    }
  }

  render(state: Readonly<PanelState>): void {
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
      this.graphics.lineStyle(1, 0x686868, 0.8);
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
      this.graphics.lineStyle(1, 0x777777, 0.8);
      this.graphics.lineBetween(fromX, from.y, toX, to.y);
      this.graphics.fillStyle(0x777777, 0.8);
      this.graphics.fillTriangle(toX, to.y, toX - 4, to.y - 3, toX - 4, to.y + 3);
    }
    state.entries.forEach((entry, index) => {
      const view = this.views.get(entry.type);
      const position = entries[index];
      if (!view || !position) return;
      const { x, y } = position;
      const alpha = entry.depleted ? 0.18 : entry.locked ? 0.36 : 1;
      if (!view.glyph) {
        this.graphics.fillStyle(this.#presentation.colorForType(entry.type), alpha);
        this.graphics.fillCircle(x, y, radius);
        this.graphics.lineStyle(entry.selected ? 3 : entry.current ? 2 : 1, entry.selected ? 0xffffff : entry.current ? 0xf3c94f : 0x101010, alpha);
        this.graphics.strokeCircle(x, y, radius);
      }
      view.glyph?.setAlpha(alpha).setDisplaySize(radius * 1.7, radius * 1.7);
      view.label?.setAlpha(alpha);
      view.count
        .setText(entry.countVisible && !entry.depleted ? `×${entry.count}` : "")
        .setColor(entry.warning ? "#ffb0a4" : "#ffffff")
        .setAlpha(alpha);
    });
  }

  clearViews(): void {
    for (const view of this.views.values()) {
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
