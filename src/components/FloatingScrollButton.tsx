import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface FloatingScrollButtonProps {
  hidden: boolean;
  hideScrollDown: boolean;
}

const FloatingScrollButton: React.FC<FloatingScrollButtonProps> = ({ hidden, hideScrollDown }) => {
  const [scrollState, setScrollState] = useState({ canScroll: false, nearTop: true, nearBottom: true });

  useEffect(() => {
    const syncScrollState = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

      setScrollState({
        canScroll: pageHeight > viewportHeight + 160,
        nearTop: scrollTop < 260,
        nearBottom: scrollTop + viewportHeight >= pageHeight - 260,
      });
    };

    syncScrollState();
    window.addEventListener('scroll', syncScrollState, { passive: true });
    window.addEventListener('resize', syncScrollState);
    return () => {
      window.removeEventListener('scroll', syncScrollState);
      window.removeEventListener('resize', syncScrollState);
    };
  }, []);

  if (hidden || !scrollState.canScroll) return null;

  const shouldScrollUp = !scrollState.nearTop;
  const shouldScrollDown = !hideScrollDown && !scrollState.nearBottom;
  if (!shouldScrollUp && !shouldScrollDown) return null;

  const targetTop = shouldScrollUp ? 0 : document.documentElement.scrollHeight;
  const label = shouldScrollUp ? 'Scroll to top' : 'Scroll to bottom';
  const Icon = shouldScrollUp ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: targetTop, behavior: 'smooth' })}
      className="fixed bottom-6 right-4 z-[900] flex h-11 w-11 items-center justify-center rounded-full border border-bit-border bg-bit-panel/85 text-bit-muted shadow-xl shadow-black/20 backdrop-blur-md transition-all hover:border-bit-accent/50 hover:bg-bit-accent hover:text-white sm:bottom-8 sm:right-6"
      aria-label={label}
      title={label}
    >
      <Icon size={18} />
    </button>
  );
};

export default FloatingScrollButton;
