import type { PdfBackgroundPresetId, PdfHighlightColorId } from './pdf-reader-storage';

export const PDF_BACKGROUND_PRESETS: Array<{
  id: PdfBackgroundPresetId;
  label: string;
  className: string;
  swatch: string;
}> = [
  {
    id: 'default',
    label: 'Default',
    className: 'bit-pdf-reader-bg-default',
    swatch: 'linear-gradient(135deg, #0f172a, #2563eb)',
  },
  {
    id: 'wood',
    label: 'Wood',
    className: 'bit-pdf-reader-bg-wood',
    swatch: 'linear-gradient(135deg, #4a2616, #a76532 52%, #2a140c)',
  },
  {
    id: 'paper',
    label: 'Paper',
    className: 'bit-pdf-reader-bg-paper',
    swatch: 'linear-gradient(135deg, #d9b66d, #fff1c9 58%, #a7772d)',
  },
  {
    id: 'sage',
    label: 'Sage',
    className: 'bit-pdf-reader-bg-sage',
    swatch: 'linear-gradient(135deg, #26382f, #7f9a78 55%, #111b16)',
  },
  {
    id: 'night',
    label: 'Night',
    className: 'bit-pdf-reader-bg-night',
    swatch: 'linear-gradient(135deg, #131821, #334055 55%, #090b10)',
  },
];

export const PDF_HIGHLIGHT_COLOR_PRESETS: Array<{
  id: PdfHighlightColorId;
  label: string;
  swatch: string;
  overlay: string;
}> = [
  { id: 'yellow', label: 'Yellow', swatch: '#fde047', overlay: 'rgba(253, 224, 71, 0.48)' },
  { id: 'mint', label: 'Mint', swatch: '#86efac', overlay: 'rgba(134, 239, 172, 0.46)' },
  { id: 'sky', label: 'Sky', swatch: '#7dd3fc', overlay: 'rgba(125, 211, 252, 0.44)' },
  { id: 'rose', label: 'Rose', swatch: '#fda4af', overlay: 'rgba(253, 164, 175, 0.46)' },
  { id: 'violet', label: 'Violet', swatch: '#c4b5fd', overlay: 'rgba(196, 181, 253, 0.44)' },
];
