/**
 * A single song chapter ready to be rendered in a print/PDF layout.
 */
export interface PrintSong {
  id: string;
  title: string;
  key?: string;
  capo?: number | null;
  lang: string;
  html: string;
  refsHtml: string;
}