export type TextToSpeechStatus = 'idle' | 'playing' | 'paused';

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: any) => void) | null;
  start: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

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

export const getSpeechWordAtBoundary = (text: string, charIndex: number) => {
  if (!text || !Number.isFinite(charIndex) || charIndex < 0) return null;
  const safeIndex = Math.min(charIndex, Math.max(0, text.length - 1));
  const after = text.slice(safeIndex);
  const relativeMatch = after.match(/[\p{L}\p{N}'-]+/u);
  if (!relativeMatch || relativeMatch.index === undefined) return null;

  const start = safeIndex + relativeMatch.index;
  const value = relativeMatch[0];
  return {
    value,
    start,
    end: start + value.length,
  };
};

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

export const getSpeechRecognitionConstructor = () => {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
};

export const isSpeechRecognitionContextAllowed = () => {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);
};

export const requestMicrophoneForSpeech = async () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
};

export const speakUtterance = (utterance: SpeechSynthesisUtterance) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  synth.resume();
  synth.speak(utterance);
  window.setTimeout(() => synth.resume(), 0);
  window.setTimeout(() => synth.resume(), 250);
};
