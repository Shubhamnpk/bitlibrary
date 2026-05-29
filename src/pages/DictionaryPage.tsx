import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Seo from '@/components/Seo';
import EnglishDictionaryPanel from '@/components/EnglishDictionaryPanel';

interface DictionaryPageProps {
  onBack: () => void;
}

const DictionaryPage: React.FC<DictionaryPageProps> = ({ onBack }) => {
  return (
    <div className="animate-fade-in pb-24 pt-4 md:pt-6">
      <Seo
        title="English Dictionary | BitLibrary"
        description="Search English word definitions, examples, phonetics, and pronunciation audio inside BitLibrary."
        canonicalPath="/dictionary"
        keywords={['English dictionary', 'word definitions', 'dictionaryapi.dev', 'pronunciation audio', 'BitLibrary dictionary']}
      />

      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/30 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <EnglishDictionaryPanel
          autoFocus
          className="min-h-[calc(100svh-10rem)] bg-[linear-gradient(180deg,rgba(var(--bit-accent-rgb),0.045),rgba(var(--bit-panel),0.22))]"
          eyebrow="English Dictionary"
          heading="Find the word you need."
          description="Search definitions, pronunciation, examples, and parts of speech."
          hero
        />
      </div>
    </div>
  );
};

export default DictionaryPage;
