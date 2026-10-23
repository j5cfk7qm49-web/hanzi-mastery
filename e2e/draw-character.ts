import { readFile } from 'node:fs/promises';
import type { Locator } from '@playwright/test';

/** Send strokes to the real Hanzi Writer engine in our development fixture. */
export async function drawCharacter(canvas: Locator, character: string) {
  const data = JSON.parse(await readFile(`node_modules/hanzi-writer-data/${character}.json`, 'utf8'));
  for (const median of data.medians as number[][][]) await canvas.evaluate((element, points: number[][]) => {
    const svg = element.querySelector('svg')!, box = svg.getBoundingClientRect(), scale = (box.width - 32) / 1024;
    const touch = (p: number[]) => ({ identifier: 1, target: svg, clientX: box.left + 16 + p[0] * scale, clientY: box.top + 16 + (900 - p[1]) * scale });
    const emit = (type: string, p: number[]) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [touch(p)] }, changedTouches: { value: [touch(p)] } });
      svg.dispatchEvent(event);
    };
    emit('touchstart', points[0]); for (const p of points.slice(1)) emit('touchmove', p); emit('touchend', points.at(-1)!);
  }, median);
}
