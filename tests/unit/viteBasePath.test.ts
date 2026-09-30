import { describe, expect, it } from 'vitest';

import { resolveBasePath } from '../../vite.config';

describe('resolveBasePath', () => {
  it('keeps the repository root path for the published main build', () => {
    expect(resolveBasePath('fabioser-ai/medieval-idle')).toBe(
      '/medieval-idle/',
    );
  });

  it('uses an explicit nested path for an isolated preview build', () => {
    expect(
      resolveBasePath(
        'fabioser-ai/medieval-idle',
        '/medieval-idle/v2-1-preview/',
      ),
    ).toBe('/medieval-idle/v2-1-preview/');
  });

  it('uses the local root when no repository or override is provided', () => {
    expect(resolveBasePath()).toBe('/');
  });
});
