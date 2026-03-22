import React from 'react';
import { Info, ShieldCheck, Zap, ArrowLeft, History, FileText, Globe, Code } from 'lucide-react';

interface StaticPageProps {
  type: 'about' | 'terms';
  onBack: () => void;
}

const StaticPage: React.FC<StaticPageProps> = ({ type, onBack }) => {
  const isAbout = type === 'about';

  return (
    <div className="animate-fade-in pb-20 max-w-4xl mx-auto">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-mono text-gray-500 hover:text-bit-accent mb-12 transition-colors uppercase tracking-widest"
      >
        <ArrowLeft size={16} /> RETURN TO STREAM
      </button>

      {isAbout ? (
        <article className="prose prose-invert prose-p:text-gray-400 prose-headings:font-display prose-headings:font-bold max-w-none">
          <header className="mb-20">
             <div className="w-16 h-16 bg-bit-accent rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(255,77,0,0.4)] animate-pulse">
                <Zap className="text-black" size={32} />
             </div>
             <h1 className="text-6xl md:text-8xl leading-none tracking-tight text-white mb-6">Neural Knowledge <br /> Stream v2.0</h1>
             <p className="text-xl text-bit-accent font-mono">Status: DEPLOYED (Stable Alpha)</p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20 not-prose">
             <div className="p-8 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-bit-accent/20 transition-colors">
                <h3 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
                   <Zap className="text-bit-accent" size={20} /> Real-time Synthesis
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                   BitLibrary isn't just a database. It's an active neural engine. 
                   Using Gemini-3 neural processing, we provide on-demand retrieval and 
                   synthesis of academic content with zero latency.
                </p>
             </div>
             <div className="p-8 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-bit-accent/20 transition-colors">
                <h3 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
                   <ShieldCheck className="text-bit-accent" size={20} /> Truth & Reliability
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                   Every stream is cross-referenced with billion-scale parameters to ensure 
                   factual reliability and academic integrity in our generated data.
                </p>
             </div>
          </section>

          <h2 className="text-3xl text-white">The Mission</h2>
          <p>
            BitLibrary emerged from a simple premise: Knowledge should be faster than our 
            current ability to catalog it. By merging generative AI with a massive, 
            low-latency edge-first infrastructure, we've bypassed traditional silos of information.
          </p>

          <h2 className="text-3xl text-white">Neural Processing Units</h2>
          <p>
            When you search, you aren't just looking for titles. You are triggering a search 
            through a multi-dimensional latent space. Our Gemini-3 Flash integration ensures 
            that retrieval is not only accurate but also rich with context.
          </p>

          <div className="p-10 rounded-3xl bg-gradient-to-br from-bit-accent/20 to-transparent border border-white/5 mt-20 not-prose">
             <h3 className="text-2xl font-display font-bold text-white mb-4">Core Contributors</h3>
             <div className="flex gap-4 items-center">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-white">BN</div>
                <div>
                   <p className="text-white font-bold leading-none">BitNepal Lab</p>
                   <p className="text-xs text-gray-500 font-mono mt-1">Research & Engineering Node</p>
                </div>
             </div>
          </div>
        </article>
      ) : (
        <article className="prose prose-invert prose-p:text-gray-400 prose-headings:font-display prose-headings:font-bold max-w-none">
          <header className="mb-20">
             <h1 className="text-5xl md:text-7xl leading-tight text-white mb-6 tracking-tight">Governance & <br /> Neural Protocol</h1>
             <p className="text-lg text-gray-500 font-mono">Last Synchronized: MARCH 2026</p>
          </header>

          <section className="space-y-12">
             <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <h3 className="text-xl text-white mb-4 flex items-center gap-2"><FileText size={20} className="text-bit-accent" /> Article 1. Archive Access</h3>
                <p className="text-sm">
                   By accessing BitLibrary nodes, you agree that synthesized knowledge is 
                   provided for educational and research purposes under our unified neural 
                   registry protocols.
                </p>
             </div>

             <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <h3 className="text-xl text-white mb-4 flex items-center gap-2"><Globe size={20} className="text-bit-accent" /> Article 2. Usage Policies</h3>
                <p className="text-sm">
                   Users must not exceed node rate limits (100 streams/min) or attempt 
                   to bridge our private neural streams without explicit clearance from 
                   the BitNepal Lab governing body.
                </p>
             </div>

             <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <h3 className="text-xl text-white mb-4 flex items-center gap-2"><Code size={20} className="text-bit-accent" /> Article 3. AI Liability</h3>
                <p className="text-sm">
                   Generated content is a reflection of current latent-space probabilities. 
                   BitLibrary is not liable for hallucinations in academic streams. Cross-check 
                   all data with primary verified nodes.
                </p>
             </div>
          </section>

          <footer className="mt-20 py-10 border-t border-white/5 text-center">
             <p className="text-gray-600 text-xs font-mono uppercase tracking-[0.2em]">End of Transmission</p>
          </footer>
        </article>
      )}
    </div>
  );
};

export default StaticPage;
