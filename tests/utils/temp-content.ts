import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import tmp from 'tmp-promise';

export interface TempContentDir {
  path: string;
  cleanup: () => Promise<void>;
  writeFile: (relativePath: string, content: string) => Promise<void>;
  readFile: (relativePath: string) => Promise<string>;
  exists: (relativePath: string) => Promise<boolean>;
  originalCwd: string;
}

export async function createTempContentDir(): Promise<TempContentDir> {
  const { path: tempPath, cleanup } = await tmp.dir({ prefix: 'songbook-test-', unsafeCleanup: true });
  
  // The content module expects a 'content' subdirectory
  const contentPath = path.join(tempPath, 'content');
  
  const dirs = [
    'library',
    'library/no-album',
    'artists',
    'config',
    'users',
    'setlists',
  ];
  
  for (const dir of dirs) {
    await mkdir(path.join(contentPath, dir), { recursive: true });
  }
  
  await writeFile(
    path.join(contentPath, 'config', 'site.yaml'),
    `title: Test Songbook\ndefaultLanguage: en\npdfPageSize: A4\nenableArtistPages: true\n`
  );
  
  await writeFile(
    path.join(contentPath, 'config', 'languages.yaml'),
    `languages: [en, es, fr]\ndefault: en\n`
  );
  
  await writeFile(
    path.join(contentPath, 'artists', 'various-artists.yaml'),
    `id: various-artists\nname: Various Artists\nbio: Songs by multiple artists.\ntags: []\n`
  );

  const originalCwd = process.cwd();
  process.chdir(tempPath);

  return {
    path: tempPath,
    contentPath,
    originalCwd,
    cleanup: async () => {
      process.chdir(originalCwd);
      try {
        await cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    },
    writeFile: async (relativePath: string, content: string) => {
      const fullPath = path.join(contentPath, relativePath);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content);
    },
    readFile: async (relativePath: string) => {
      const { readFile } = await import('fs/promises');
      return readFile(path.join(contentPath, relativePath), 'utf-8');
    },
    exists: async (relativePath: string) => {
      const { existsSync } = await import('fs');
      return existsSync(path.join(contentPath, relativePath));
    },
  };
}