import React, { useState, useEffect } from 'react';
import { ListTree, Hash } from 'lucide-react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface BlogTableOfContentsProps {
  content: string;
}

const parseToc = (content: string): TocItem[] => {
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    items.push({ id, text, level });
  }

  return items;
};

const BlogTableOfContents: React.FC<BlogTableOfContentsProps> = ({ content }) => {
  const [activeId, setActiveId] = useState<string>('');
  const items = parseToc(content);

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <nav className="rounded-2xl border border-bit-border bg-bit-panel p-5 sticky top-24 shadow-lg shadow-bit-bg/80">
      <div className="flex items-center gap-2 mb-4">
        <ListTree size={14} className="text-bit-accent" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-bit-accent font-bold">On this page</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(item.id);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  history.pushState(null, '', `#${item.id}`);
                }
              }}
              className={`block text-[11px] font-mono py-1 transition-all rounded-lg hover:text-bit-accent ${
                activeId === item.id
                  ? 'text-bit-accent font-bold'
                  : 'text-bit-muted hover:text-bit-text'
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default BlogTableOfContents;
