import { readFile } from 'fs/promises';
import path from 'path';
import { getPartitionsDir } from '@/lib/partitions';

/**
 * Read a partition PDF buffer, guarding against directory traversal outside
 * the partitions root. Returns null when the path is unsafe or unreadable.
 */
export async function loadPartitionPdf(relPath: string): Promise<Uint8Array | null> {
  const root = path.resolve(getPartitionsDir());
  const fullPath = path.resolve(root, relPath);
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) return null;
  if (path.extname(fullPath).toLowerCase() !== '.pdf') return null;
  try {
    const buffer = await readFile(fullPath);
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}