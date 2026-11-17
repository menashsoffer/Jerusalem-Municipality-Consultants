import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';

const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\b`, 'i').exec(css);
  if (!match?.[1]) throw new Error(`Missing six-digit token --${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

it('keeps badge text at 4.5:1 and badge borders at 3:1 against their surfaces', () => {
  for (const kind of ['success', 'warning', 'danger']) {
    const surface = token(`color-badge-${kind}-surface`);
    const text = ratio(token(`color-badge-${kind}-text`), surface);
    const border = ratio(token(`color-badge-${kind}-border`), surface);
    assert.ok(text >= 4.5, `${kind} text ${text.toFixed(2)}:1`);
    assert.ok(border >= 3, `${kind} border ${border.toFixed(2)}:1`);
  }
  assert.ok(ratio(token('color-muted'), token('color-subtle')) >= 4.5, 'neutral badge text');
});
