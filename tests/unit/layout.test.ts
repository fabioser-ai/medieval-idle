import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parse } from 'postcss';

// Source-level geometry contract, not a browser/layout-engine pass. The E2E
// suite measures actual canvas/control rectangles at both target viewports.
it('reserves an intrinsic controls row below a shrinkable battlefield instead of overlaying combat', () => {
  const sheet = parse(readFileSync('src/styles.css', 'utf8'));
  const declarations = (selector: string) => {
    const result: Record<string, string> = {};
    sheet.walkRules(selector, (rule) => {
      if (rule.parent?.type === 'root')
        rule.walkDecls((d) => {
          result[d.prop] = d.value;
        });
    });
    return result;
  };
  const main = declarations('main');
  expect(main.display).toBe('grid');
  expect(main['grid-template-rows']).toBe('auto minmax(0, 1fr) auto');
  expect(main.height).toBe('100dvh');
  const game = declarations('#game');
  expect(game.position).toBe('relative');
  expect(game['grid-row']).toBe('2');
  expect(game['min-height']).toBe('0');
  expect(game.height).toBe('100%');
  const viewing = declarations('.viewing');
  expect(viewing.position).toBe('static');
  expect(viewing['grid-row']).toBe('3');
  expect(viewing.width).toBe('100%');
  expect(declarations('input,\nselect,\nbutton')['min-height']).toBe('44px');
  expect(declarations('.deployment')['overflow-y']).toBe('auto');
});
