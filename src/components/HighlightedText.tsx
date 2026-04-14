import React from 'react';

/**
 * Highlights matches in text based on a search query.
 */
export const HighlightedText: React.FC<{ text: string; query?: string; className?: string }> = ({ 
  text, 
  query, 
  className = "bg-bit-accent/30 text-bit-text rounded-sm px-0.5" 
}) => {
  if (!query || !query.trim()) {
    return <>{text}</>;
  }

  const trimmedQuery = query.trim();
  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === trimmedQuery.toLowerCase() ? (
          <mark key={i} className={className}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};
