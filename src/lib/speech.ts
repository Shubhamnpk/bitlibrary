export type TextToSpeechStatus = 'idle' | 'playing' | 'paused';

export const getPreferredSpeechVoiceURI = (voices: SpeechSynthesisVoice[]) => {
  const englishVoices = voices.filter((voice) => /^en([-_]|$)/i.test(voice.lang));
  const naturalNamePattern = /natural|online|aria|jenny|guy|google|samantha|daniel/i;

  return (
    englishVoices.find((voice) => voice.default && naturalNamePattern.test(voice.name))?.voiceURI ||
    englishVoices.find((voice) => naturalNamePattern.test(voice.name))?.voiceURI ||
    englishVoices.find((voice) => voice.default)?.voiceURI ||
    englishVoices[0]?.voiceURI ||
    voices.find((voice) => voice.default)?.voiceURI ||
    voices[0]?.voiceURI ||
    ''
  );
};

export const normalizeSpeechMatchText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

export const getSpeechText = (value: string) => (
  value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

export const getSpeechSegments = (value: string): string[] => {
  const text = getSpeechText(value);
  if (!text) return [];
  return text.match(/[^.!?\u0964]+[.!?\u0964]?/g)?.map((segment) => segment.trim()).filter(Boolean) || [text];
};
