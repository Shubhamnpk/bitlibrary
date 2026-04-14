import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Disc } from 'lucide-react';

interface FooterProps {
  isReaderActive: boolean;
}

const Footer: React.FC<FooterProps> = ({ isReaderActive }) => {
  if (isReaderActive) return null;

  return (
    <footer className="border-t border-bit-border/50 pt-20 pb-12 bg-bit-panel/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-bit-accent/50 to-transparent opacity-20" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
          <div className="lg:col-span-4">
            <Link to="/" className="inline-flex items-center mb-6 group">
              <img
                src="/assets/bitlibrary-icon-clean.svg"
                alt="BitLibrary"
                className="h-10 w-auto"
              />
              <span className="ml-3 font-display font-bold text-2xl text-bit-text tracking-tighter">BitLibrary</span>
            </Link>
            <p className="text-bit-muted text-sm leading-relaxed mb-8 max-w-sm">
              The Open Digital Library for accessible discovery, open archives, and modern reading.
              Built to connect books, authors, and knowledge in one searchable interface.
            </p>
            <div className="flex gap-4">
              <a
                href="https://github.com/Shubhamnpk/bitlibrary"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open BitLibrary source code on GitHub"
                className="p-2 rounded-full border border-bit-border hover:border-bit-accent/50 text-bit-muted hover:text-bit-accent transition-all"
              >
                <Github size={18} />
              </a>
              <button className="p-2 rounded-full border border-bit-border hover:border-bit-accent/50 text-bit-muted hover:text-bit-accent transition-all"><Disc size={18} /></button>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-3 gap-8 text-[10px] font-mono">
            <div>
              <h4 className="text-bit-text font-medium mb-6 uppercase tracking-widest opacity-40">Library Hub</h4>
              <ul className="space-y-4 text-bit-muted">
                <li><Link to="/library" className="hover:text-bit-accent transition-all">CENTRAL REGISTRY</Link></li>
                <li><Link to="/" className="hover:text-bit-accent transition-all">COLLECTIONS</Link></li>
                <li><Link to="/mylibrary" className="hover:text-bit-accent transition-all">MY ARCHIVE</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-bit-text font-medium mb-6 uppercase tracking-widest opacity-40">Protocol</h4>
              <ul className="space-y-4 text-bit-muted">
                <li><Link to="/about" className="hover:text-bit-accent transition-all">ABOUT ENGINE</Link></li>
                <li><Link to="/terms" className="hover:text-bit-accent transition-all">TERMS OF USE</Link></li>
                <li><button className="hover:text-bit-accent transition-all uppercase">NEURAL AUDIT</button></li>
              </ul>
            </div>
            <div className="hidden md:block">
              <h4 className="text-bit-text font-medium mb-6 uppercase tracking-widest opacity-40">Lab Status</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-[9px] text-bit-muted">STABLE</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-bit-accent shadow-[0_0_8px_rgba(255,77,0,0.6)]" />
                  <span className="text-[9px] text-bit-muted">SYNC ACTIVE</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="p-6 rounded-2xl bg-bit-panel/30 border border-bit-border relative group hover:border-bit-accent/40 transition-all shadow-sm">
              <h4 className="text-bit-text font-display font-bold mb-2">Join the Lab</h4>
              <p className="text-[10px] text-bit-muted mb-6 font-mono leading-relaxed uppercase">
                Enroll in the neural notification stream.
              </p>
              <div className="relative">
                <input
                  type="email"
                  placeholder="ARCHIVE_ID@EMAIL.NET"
                  className="w-full bg-bit-bg/50 border border-bit-border rounded py-2 px-3 text-[10px] font-mono focus:outline-none focus:border-bit-accent/50 transition-all text-bit-text"
                />
                <button className="absolute right-1 top-1 bottom-1 px-2 bg-bit-accent text-white text-[9px] font-bold rounded hover:scale-95 transition-all">ENROLL</button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-bit-border/50 pt-12 text-[10px] font-mono text-bit-muted uppercase tracking-widest">
          <div>© 2026 BitLibrary • The Open Digital Library Platform</div>
          <div className="flex items-center gap-4">
            <span>Infrastructure:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className={`h-1 w-3 rounded-full ${i < 5 ? 'bg-bit-accent/40' : 'bg-bit-border'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
