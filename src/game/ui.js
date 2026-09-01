import Phaser from "phaser";
import {
  GAMEPLAY_ATLAS,
  GAMEPLAY_FONT,
  UI_ATLAS,
  UI_FRAMES,
} from "../art-assets.js";

const SLICE_BORDERS = Object.freeze({
  button: Object.freeze([42, 42, 42, 42]),
  level: Object.freeze([36, 36, 36, 36]),
  panel: Object.freeze([30, 30, 36, 36]),
  strip: Object.freeze([34, 34, 24, 24]),
});

function bordersForFrame(frame) {
  if (frame.startsWith("button_")) return SLICE_BORDERS.button;
  if (frame.startsWith("level_")) return SLICE_BORDERS.level;
  if (frame.includes("strip") || frame === UI_FRAMES.panelHeader) {
    return SLICE_BORDERS.strip;
  }
  return SLICE_BORDERS.panel;
}

export function preloadUiAssets(scene) {
  if (!scene.textures.exists(UI_ATLAS.key)) {
    scene.load.multiatlas(UI_ATLAS.key, UI_ATLAS.jsonUrl, UI_ATLAS.baseUrl);
  }
  if (!scene.textures.exists(GAMEPLAY_ATLAS.key)) {
    scene.load.multiatlas(
      GAMEPLAY_ATLAS.key,
      GAMEPLAY_ATLAS.jsonUrl,
      GAMEPLAY_ATLAS.baseUrl,
    );
  }
}

export function makeText(scene, text, size, color = "#3a3f3c") {
  const value = scene.add.text(0, 0, text, {
    fontFamily: `${GAMEPLAY_FONT.family}, Arial, "Segoe UI", sans-serif`,
    fontSize: `${size}px`,
    color,
    align: "center",
  });
  return value.setResolution(Math.min(2, globalThis.devicePixelRatio || 1));
}

export function resizeNineSlice(slice, width, height) {
  const frameWidth = Math.max(1, slice.frame?.width ?? width);
  const frameHeight = Math.max(1, slice.frame?.height ?? height);
  const scale = Math.max(0.01, Math.min(width / frameWidth, height / frameHeight));
  slice.setSize(width / scale, height / scale).setScale(scale);
  return slice;
}

export function makePanel(scene, frame = UI_FRAMES.panelMainMedium, depth = 0) {
  const [left, right, top, bottom] = bordersForFrame(frame);
  return scene.add
    .nineslice(0, 0, UI_ATLAS.key, frame, 280, 380, left, right, top, bottom)
    .setDepth(depth);
}

const BUTTON_FRAMES = Object.freeze({
  idle: UI_FRAMES.buttonIdle,
  hover: UI_FRAMES.buttonHover,
  selected: UI_FRAMES.buttonSelected,
  disabled: UI_FRAMES.buttonDisabled,
});

const LEVEL_FRAMES = Object.freeze({
  idle: UI_FRAMES.levelIdle,
  hover: UI_FRAMES.levelHover,
  current: UI_FRAMES.levelCurrent,
  completed: UI_FRAMES.levelCompleted,
  locked: UI_FRAMES.levelLocked,
  disabled: UI_FRAMES.levelLocked,
});

export class AtlasButton extends Phaser.GameObjects.Container {
  constructor(scene, label, onClick, size = 16, { level = false } = {}) {
    const frames = level ? LEVEL_FRAMES : BUTTON_FRAMES;
    const background = makePanel(scene, frames.idle);
    const text = makeText(scene, label, size, "#303632")
      .setOrigin(0.5)
      .setAlign("center")
      .setFontStyle("bold");
    super(scene, 0, 0, [background, text]);
    scene.add.existing(this);

    this.background = background;
    this.label = text;
    this.frames = frames;
    this.baseFrame = frames.idle;
    this.enabled = true;
    this.buttonWidth = level ? 72 : 180;
    this.buttonHeight = level ? 52 : 50;
    this.icon = undefined;
    this.iconOnly = false;
    this.setFixedSize(this.buttonWidth, this.buttonHeight);
    this.setInteractive({ useHandCursor: true });
    this.on("pointerover", () => {
      if (this.enabled) this.background.setFrame(this.frames.hover);
    });
    this.on("pointerout", () => {
      if (this.enabled) this.background.setFrame(this.baseFrame);
    });
    this.on("pointerdown", () => {
      if (this.enabled) this.background.setFrame(this.frames.selected ?? this.baseFrame);
    });
    this.on("pointerup", () => {
      if (this.enabled) this.background.setFrame(this.frames.hover);
    });
    this.on("pointerdown", onClick);
  }

  setFixedSize(width, height) {
    this.buttonWidth = width;
    this.buttonHeight = height;
    resizeNineSlice(this.background, width, height);
    this.setSize(width, height);
    this.label.setFixedSize(Math.max(1, width - 28), 0).setOrigin(0.5);
    if (this.input?.hitArea) {
      this.input.hitArea.setTo(0, 0, width, height);
    }
    this.layoutContent();
    return this;
  }

  setInteractive(config = {}) {
    const hitArea = new Phaser.Geom.Rectangle(
      0,
      0,
      this.buttonWidth,
      this.buttonHeight,
    );
    if (this.input) {
      this.input.enabled = true;
      this.input.hitArea = hitArea;
      this.input.hitAreaCallback = Phaser.Geom.Rectangle.Contains;
    } else {
      Phaser.GameObjects.Container.prototype.setInteractive.call(
        this,
        hitArea,
        Phaser.Geom.Rectangle.Contains,
      );
    }
    this.enabled = true;
    this.background.setFrame(this.baseFrame);
    if (config?.useHandCursor && this.input) this.input.cursor = "pointer";
    return this;
  }

  disableInteractive() {
    Phaser.GameObjects.Container.prototype.disableInteractive.call(this);
    this.enabled = false;
    this.background.setFrame(this.frames.disabled ?? this.baseFrame);
    return this;
  }

  setEnabled(enabled) {
    if (!enabled) return this.disableInteractive();
    this.enabled = true;
    this.background.setFrame(this.baseFrame);
    if (this.input) {
      this.input.enabled = true;
      this.input.cursor = "pointer";
      return this;
    }
    return this.setInteractive({ useHandCursor: true });
  }

  setBaseFrame(frame) {
    this.baseFrame = frame;
    if (this.enabled) this.background.setFrame(frame);
    return this;
  }

  setLevelState(state) {
    const frame = this.frames[state] ?? this.frames.idle;
    this.setBaseFrame(frame);
    if (state === "locked") this.disableInteractive();
    return this;
  }

  setIcon(frame, size = 22, iconOnly = false, texture = GAMEPLAY_ATLAS.key) {
    this.icon?.destroy();
    this.icon = frame
      ? this.scene.add.image(0, 0, texture, frame).setDisplaySize(size, size)
      : undefined;
    if (this.icon) this.addAt(this.icon, 1);
    this.iconOnly = iconOnly;
    this.label.setVisible(!iconOnly);
    this.layoutContent();
    return this;
  }

  layoutContent() {
    if (!this.label) return this;
    if (!this.icon) {
      this.label.setPosition(0, 0);
      return this;
    }
    if (this.iconOnly || !this.label.text) {
      this.icon.setPosition(0, 0);
      return this;
    }
    const iconX = -this.buttonWidth / 2 + Math.min(30, this.buttonHeight * 0.55);
    this.icon.setPosition(iconX, 0);
    this.label.setPosition(Math.min(14, this.buttonHeight * 0.22), 0);
    return this;
  }

  setText(value) {
    this.label.setText(value);
    this.layoutContent();
    return this;
  }

  setFontSize(value) {
    this.label.setFontSize(value);
    return this;
  }

  setColor(value) {
    this.label.setColor(value);
    return this;
  }

  setAlign(value) {
    this.label.setAlign(value);
    return this;
  }

  setFontStyle(value) {
    this.label.setFontStyle(value);
    return this;
  }

  setWordWrapWidth(value) {
    this.label.setWordWrapWidth(value);
    return this;
  }

  setPadding(...values) {
    this.label.setPadding(...values);
    return this;
  }

  setBackgroundColor() {
    this.setBaseFrame(this.frames.selected ?? this.baseFrame);
    return this;
  }
}

export function makeButton(scene, label, onClick, size = 16) {
  return new AtlasButton(scene, label, onClick, size);
}

export function makeLevelButton(scene, label, onClick, size = 12) {
  return new AtlasButton(scene, label, onClick, size, { level: true });
}

export function setButtonEnabled(button, enabled) {
  if (button.setEnabled) button.setEnabled(enabled);
  else {
    button.setAlpha(enabled ? 1 : 0.5);
    if (enabled) button.setInteractive({ useHandCursor: true });
    else button.disableInteractive();
  }
}
