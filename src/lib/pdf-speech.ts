export type PdfSpeechStatus = 'idle' | 'loading' | 'playing' | 'paused';

export type PdfSpeechSegment = {
  text: string;
  itemStart: number;
  itemEnd: number;
};

export type PdfSpeechItemRange = {
  start: number;
  end: number;
};

export const getPdfSpeechSegments = (itemTexts: string[]): PdfSpeechSegment[] => {
  const segments: PdfSpeechSegment[] = [];
  let currentTexts: string[] = [];
  let currentStart = -1;

  itemTexts.forEach((itemText, itemIndex) => {
    const text = itemText.replace(/\s+/g, ' ').trim();
    if (!text) return;

    if (currentStart === -1) currentStart = itemIndex;
    currentTexts.push(text);

    const sentenceText = currentTexts.join(' ').replace(/\s+/g, ' ').trim();
    const endsSentence = /[.!?\u0964]["')\]]?$/.test(text);
    const isLongEnough = sentenceText.length > 220;

    if (endsSentence || isLongEnough) {
      segments.push({ text: sentenceText, itemStart: currentStart, itemEnd: itemIndex });
      currentTexts = [];
      currentStart = -1;
    }
  });

  if (currentTexts.length > 0 && currentStart !== -1) {
    segments.push({
      text: currentTexts.join(' ').replace(/\s+/g, ' ').trim(),
      itemStart: currentStart,
      itemEnd: itemTexts.length - 1,
    });
  }

  return segments;
};
