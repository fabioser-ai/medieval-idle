import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const samples = [
  'march-1.ogg',
  'march-2.ogg',
  'drums-loop.ogg',
  'cavalry-loop.ogg',
  'horn-charge.ogg',
  'arrows-1.ogg',
  'arrows-2.ogg',
  'impact-1.ogg',
  'impact-2.ogg',
  'melee-1.ogg',
  'melee-2.ogg',
  'result.ogg',
] as const;

describe('V2.1 real battle audio assets', () => {
  it.each(samples)(
    '%s is a non-empty Ogg stream shipped with the game',
    async (name) => {
      const path = resolve('public/audio/v2', name);
      const [header, file] = await Promise.all([readFile(path), stat(path)]);

      expect(header.subarray(0, 4).toString('ascii')).toBe('OggS');
      expect(file.size).toBeGreaterThan(4_096);
      expect(file.size).toBeLessThan(250_000);
    },
  );
});
