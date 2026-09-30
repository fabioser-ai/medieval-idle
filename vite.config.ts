import { defineConfig } from 'vite';

export function resolveBasePath(
  repositorySlug?: string,
  override?: string,
): string {
  if (override) return override;

  const repository = repositorySlug?.split('/')[1];
  return repository ? `/${repository}/` : '/';
}

export default defineConfig({
  base: resolveBasePath(
    process.env.GITHUB_REPOSITORY,
    process.env.VITE_BASE_PATH,
  ),
  build: {
    chunkSizeWarningLimit: 1400,
  },
});
