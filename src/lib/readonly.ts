export function isReadOnly(): boolean {
  return process.env.SONGBOOK_READONLY === "1";
}