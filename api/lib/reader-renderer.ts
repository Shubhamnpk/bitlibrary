import katex from 'katex';
import { parseArticleXml } from './article-xml.js';

const escapeHtml = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
);

const escapeText = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);

const NAMED_TEXT_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  ndash: '\u2013', mdash: '\u2014', lsquo: '\u2018', rsquo: '\u2019', sbquo: '\u201a',
  ldquo: '\u201c', rdquo: '\u201d', bdquo: '\u201e', hellip: '\u2026', middot: '\u00b7',
  bull: '\u2022', dagger: '\u2020', Dagger: '\u2021', prime: '\u2032', Prime: '\u2033',
  laquo: '\u00ab', raquo: '\u00bb', lsaquo: '\u2039', rsaquo: '\u203a', copy: '\u00a9',
  reg: '\u00ae', trade: '\u2122', deg: '\u00b0', plusmn: '\u00b1', micro: '\u00b5',
  times: '\u00d7', divide: '\u00f7', minus: '\u2212', le: '\u2264', ge: '\u2265',
  ne: '\u2260', asymp: '\u2248', sim: '\u223c', infin: '\u221e', prop: '\u221d',
  alpha: '\u03b1', beta: '\u03b2', gamma: '\u03b3', delta: '\u03b4', epsilon: '\u03b5',
  zeta: '\u03b6', eta: '\u03b7', theta: '\u03b8', lambda: '\u03bb', mu: '\u03bc',
  pi: '\u03c0', rho: '\u03c1', sigma: '\u03c3', tau: '\u03c4', phi: '\u03c6',
  chi: '\u03c7', omega: '\u03c9', Alpha: '\u0391', Beta: '\u0392', Gamma: '\u0393',
  Delta: '\u0394', Theta: '\u0398', Lambda: '\u039b', Pi: '\u03a0', Sigma: '\u03a3',
  Phi: '\u03a6', Omega: '\u03a9',
};

const decodeXmlText = (value: string) => {
  let decoded = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  for (let index = 0; index < 4; index += 1) {
    const previous = decoded;
    decoded = decoded
      .replace(/&#(\d+);/g, (match, code) => {
        const point = Number(code);
        try {
          return Number.isFinite(point) ? String.fromCodePoint(point) : match;
        } catch {
          return match;
        }
      })
      .replace(/&#x([\da-f]+);/gi, (match, code) => {
        const point = parseInt(code, 16);
        try {
          return Number.isFinite(point) ? String.fromCodePoint(point) : match;
        } catch {
          return match;
        }
      })
      .replace(/&([A-Za-z][A-Za-z0-9]+);/g, (match, name) => NAMED_TEXT_ENTITIES[name] ?? match);
    if (decoded === previous) break;
  }
  return decoded;
};

const getTagText = (xml: string, tagName: string) => {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeXmlText(match[1]).replace(/\s+/g, ' ').trim() : '';
};

const getInfonValue = (xml: string, key: string) => {
  const match = xml.match(new RegExp(`<infon\\s+key=["']${key}["']>([\\s\\S]*?)<\\/infon>`, 'i'));
  return match ? decodeXmlText(match[1]).replace(/\s+/g, ' ').trim() : '';
};

const getXmlAttribute = (xml: string, name: string) => {
  const match = xml.match(new RegExp(`\\s${name}=["']([^"']+)["']`, 'i'));
  return match ? decodeXmlText(match[1]).replace(/[^\w .:%-]/g, '').trim() : '';
};

const getCellAttributes = (cellXml: string) => {
  const attrs = [
    ['colspan', getXmlAttribute(cellXml, 'colspan')],
    ['rowspan', getXmlAttribute(cellXml, 'rowspan')],
  ].filter(([, value]) => /^\d{1,2}$/.test(value));
  const align = getXmlAttribute(cellXml, 'align');
  const style = /^(left|right|center|justify|char)$/i.test(align) ? ` style="text-align:${align.toLowerCase() === 'char' ? 'right' : align.toLowerCase()}"` : '';
  return `${attrs.map(([name, value]) => ` ${name}="${value}"`).join('')}${style}`;
};

const getHrefAttribute = (xml: string) => (
  decodeXmlText(
    xml.match(/\s(?:xlink:href|href|rid)=["']([^"']+)["']/i)?.[1] || '',
  ).replace(/[^\w .:%/?#=&+@~,-]/g, '').trim()
);

const getRidValues = (xml: string) => (
  decodeXmlText(xml.match(/\srid=["']([^"']+)["']/i)?.[1] || '')
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean)
);

const getXmlId = (xml: string) => {
  const openingTag = xml.match(/^<[\w:-]+\b[^>]*>/i)?.[0] || '';
  const value = decodeXmlText(openingTag.match(/\s(?:xml:)?id=["']([^"']+)["']/i)?.[1] || '')
    .replace(/[^\w.-]/g, '')
    .trim();
  return /^[A-Za-z][\w.-]{0,100}$/.test(value) ? value : '';
};

const anchorIdAttr = (id: string) => (id ? ` id="${escapeHtml(id)}"` : '');

const anchorIdFromValue = (value: string) => {
  const id = decodeXmlText(value).replace(/[^\w.-]/g, '').trim();
  return /^[A-Za-z][\w.-]{0,100}$/.test(id) ? id : '';
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasDescendantXmlId = (xml: string, id: string) => {
  if (!id) return false;
  const descendants = xml.replace(/^<[\w:-]+\b[^>]*>/i, '');
  return new RegExp(`<[\\w:-]+\\b[^>]*\\s(?:xml:)?id=["']${escapeRegExp(id)}["']`, 'i').test(descendants);
};

const stripLowPriorityDuplicateAnchorIds = (html: string) => {
  const concreteIds = new Set<string>();
  const lowPriorityIds = new Set<string>();
  Array.from(html.matchAll(/<([a-z][\w:-]*)\b[^>]*\sid="([^"]+)"/gi)).forEach((match) => {
    if (/^(?:h[1-6]|ul|ol)$/i.test(match[1])) lowPriorityIds.add(match[2]);
    else concreteIds.add(match[2]);
  });
  const duplicateLowPriorityIds = new Set(Array.from(lowPriorityIds).filter((id) => concreteIds.has(id)));
  if (duplicateLowPriorityIds.size === 0) return html;
  return html.replace(/<(h[1-6]|ul|ol)([^>]*?)\sid="([^"]+)"([^>]*)>/gi, (full, tag, before, id, after) => (
    duplicateLowPriorityIds.has(id) ? `<${tag}${before}${after}>` : full
  ));
};

const readerTargetHighlightScript = `(() => {
      const targetClass = 'reader-target-highlight';
      const targetSelector = '[id]';
      let activeTarget = null;
      let cleanupTimer = 0;
      const getHashTarget = () => {
        if (!window.location.hash || window.location.hash.length < 2) return null;
        try {
          return document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
        } catch {
          return document.getElementById(window.location.hash.slice(1));
        }
      };
      const flashTarget = (target, shouldScroll = true) => {
        if (!target || !target.matches(targetSelector)) return;
        window.clearTimeout(cleanupTimer);
        if (activeTarget && activeTarget !== target) activeTarget.classList.remove(targetClass);
        activeTarget = target;
        target.classList.remove(targetClass);
        void target.offsetWidth;
        target.classList.add(targetClass);
        if (shouldScroll) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        cleanupTimer = window.setTimeout(() => {
          target.classList.remove(targetClass);
          if (activeTarget === target) activeTarget = null;
        }, 2800);
      };
      document.addEventListener('click', (event) => {
        const link = event.target?.closest?.('a[href^="#"]');
        if (!link) return;
        const id = link.getAttribute('href').slice(1);
        if (!id) return;
        const nextHash = '#' + id;
        let target = null;
        try {
          target = document.getElementById(decodeURIComponent(id));
        } catch {
          target = document.getElementById(id);
        }
        if (!target) return;
        event.preventDefault();
        if (window.location.hash === nextHash) {
          flashTarget(target);
          return;
        }
        window.location.hash = nextHash;
        flashTarget(target);
      });
      window.addEventListener('hashchange', () => flashTarget(getHashTarget(), false));
      window.requestAnimationFrame(() => flashTarget(getHashTarget(), false));
    })();`;

const readerSelectionStyle = `
    mark.user-highlight{border-radius:3px;padding:0 .14em;-webkit-box-decoration-break:clone;box-decoration-break:clone;text-decoration:underline;text-decoration-thickness:.14em;text-underline-offset:.16em;text-decoration-color:rgba(255,255,255,.38);box-shadow:0 0 0 1px rgba(255,255,255,.14),0 8px 22px rgba(0,0,0,.14)}
    #highlight-popover{position:fixed;z-index:20;display:none;align-items:center;gap:3px;border:1px solid rgba(161,161,170,.36);border-radius:999px;background:rgba(24,24,27,.9);color:#f4f4f5;padding:5px;font:700 11px/1 ui-sans-serif,system-ui,sans-serif;box-shadow:0 18px 46px rgba(0,0,0,.42),0 0 0 1px rgba(255,255,255,.04);backdrop-filter:blur(14px);transform:translateY(4px) scale(.98);opacity:0;transition:opacity .12s ease,transform .12s ease}
    #highlight-popover.open{display:flex;opacity:1;transform:translateY(0) scale(1)}
    #highlight-popover:after{content:"";position:absolute;left:var(--arrow-left,50%);top:100%;width:9px;height:9px;border-right:1px solid rgba(161,161,170,.36);border-bottom:1px solid rgba(161,161,170,.36);background:inherit;transform:translate(-50%,-4px) rotate(45deg);backdrop-filter:inherit}
    #highlight-popover.below:after{top:auto;bottom:100%;transform:translate(-50%,4px) rotate(225deg)}
    #highlight-popover button{height:32px;border:0;border-radius:999px;background:transparent;color:inherit;font:inherit;cursor:pointer;transition:background .12s ease,color .12s ease,transform .12s ease}
    #highlight-popover button:hover{background:rgba(255,255,255,.09);color:#67e8f9}#highlight-popover button:active{transform:scale(.94)}
    .icon-action{display:inline-flex;width:34px;align-items:center;justify-content:center;padding:0!important}.icon-action svg{width:16px;height:16px}
    .marker-action{position:relative;overflow:hidden;color:var(--marker-fg,#111827)!important;background:var(--marker-bg,#facc15)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.34),0 6px 16px rgba(0,0,0,.2)}.marker-action svg{position:relative;z-index:1}.marker-action .marker-swatch{position:absolute;inset:5px;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.42),rgba(255,255,255,0)),var(--marker-bg,#facc15)}
    #remove-highlight-action{display:none;color:#fca5a5!important}#remove-highlight-action.available{display:inline-flex}
    #color-toggle{width:24px;padding:0!important;color:#a1a1aa}
    .color-menu{position:absolute;left:5px;top:44px;display:none;grid-template-columns:repeat(4,24px);gap:7px;border:1px solid rgba(161,161,170,.34);border-radius:999px;background:rgba(24,24,27,.94);padding:7px;box-shadow:0 18px 46px rgba(0,0,0,.42);backdrop-filter:blur(14px)}
    .color-menu.open{display:grid}.color-action{width:24px;height:24px!important;padding:0!important;border:2px solid transparent!important;background:var(--swatch)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.45),0 5px 12px rgba(0,0,0,.22)}.color-action[aria-pressed="true"]{border-color:#fff!important;box-shadow:0 0 0 2px rgba(103,232,249,.34),inset 0 0 0 1px rgba(255,255,255,.5)}
    @media (max-width:560px){#highlight-popover{gap:2px;padding:4px}.icon-action{width:32px}#highlight-popover button{height:31px}.color-menu{left:50%;transform:translateX(-50%);border-radius:18px;grid-template-columns:repeat(4,24px)}}`;

const readerSelectionToolbarHtml = `<div id="highlight-popover" role="toolbar" aria-label="Selection actions"><button id="highlight-action" class="icon-action marker-action" type="button" title="Highlight selected text" aria-label="Highlight selected text"><span id="current-highlight-swatch" class="marker-swatch"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 11 4 4L22 6l-4-4-9 9Z"/><path d="m13 15-5 5H4v-4l5-5"/><path d="m16 5 3 3"/></svg></button><button id="color-toggle" type="button" title="Choose highlight color" aria-label="Choose highlight color" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="color-menu" class="color-menu"><button class="color-action" type="button" data-bg="#facc15" data-fg="#111827" style="--swatch:#facc15" aria-label="Yellow highlight" aria-pressed="true"></button><button class="color-action" type="button" data-bg="#67e8f9" data-fg="#083344" style="--swatch:#67e8f9" aria-label="Cyan highlight" aria-pressed="false"></button><button class="color-action" type="button" data-bg="#86efac" data-fg="#052e16" style="--swatch:#86efac" aria-label="Green highlight" aria-pressed="false"></button><button class="color-action" type="button" data-bg="#f9a8d4" data-fg="#500724" style="--swatch:#f9a8d4" aria-label="Pink highlight" aria-pressed="false"></button></div><button id="remove-highlight-action" class="icon-action" type="button" title="Remove highlight from selection" aria-label="Remove highlight from selection"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 21-4-4 11-11 4 4-9 9"/><path d="m14 6 3-3 4 4-3 3"/><path d="M3 21h18"/><path d="m9 19 2 2"/></svg></button><button id="read-action" class="icon-action" type="button" title="Read selected text" aria-label="Read selected text"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg></button></div>`;

const readerSelectionScript = `(() => {
      const popover = document.getElementById('highlight-popover');
      const highlightAction = document.getElementById('highlight-action');
      const removeAction = document.getElementById('remove-highlight-action');
      const readAction = document.getElementById('read-action');
      const colorToggle = document.getElementById('color-toggle');
      const colorMenu = document.getElementById('color-menu');
      const colorActions = Array.from(document.querySelectorAll('.color-action'));
      const article = document.querySelector('[data-reader-content]');
      let selectedColor = { bg: '#facc15', fg: '#111827' };
      let savedRange = null;
      let hideTimer = 0;
      const hide = () => {
        window.clearTimeout(hideTimer);
        popover.classList.remove('open');
        removeAction.classList.remove('available');
        colorMenu.classList.remove('open');
        colorToggle.setAttribute('aria-expanded', 'false');
      };
      const unwrapHighlight = (mark) => {
        const parent = mark.parentNode;
        if (!parent) return;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      };
      const selectedTextNodes = (range) => {
        const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent || parent.closest('script,style,button,#highlight-popover')) return NodeFilter.FILTER_REJECT;
            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          },
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
      };
      const highlightsInRange = (range) => Array.from(article.querySelectorAll('mark.user-highlight')).filter((mark) => {
        try { return range.intersectsNode(mark); } catch { return false; }
      });
      const applyHighlightStyle = (mark) => {
        mark.style.backgroundColor = selectedColor.bg;
        mark.style.color = selectedColor.fg;
        mark.style.textDecorationColor = selectedColor.fg === '#111827' ? 'rgba(17,24,39,.32)' : 'rgba(255,255,255,.42)';
      };
      const highlightRange = (range) => {
        const nodes = selectedTextNodes(range);
        let applied = 0;
        nodes.forEach((node) => {
          const start = node === range.startContainer ? range.startOffset : 0;
          const end = node === range.endContainer ? range.endOffset : node.textContent.length;
          if (end <= start || !node.textContent.slice(start, end).trim()) return;
          const parentHighlight = node.parentElement?.closest('mark.user-highlight');
          if (parentHighlight) {
            applyHighlightStyle(parentHighlight);
            applied += 1;
            return;
          }
          const nodeRange = document.createRange();
          nodeRange.setStart(node, start);
          nodeRange.setEnd(node, end);
          const mark = document.createElement('mark');
          mark.className = 'user-highlight';
          applyHighlightStyle(mark);
          try {
            nodeRange.surroundContents(mark);
            applied += 1;
          } catch {
            const selected = nodeRange.extractContents();
            mark.appendChild(selected);
            nodeRange.insertNode(mark);
            applied += 1;
          }
        });
        article.normalize();
        return applied > 0;
      };
      const setSelectedColor = (color) => {
        selectedColor = { bg: color.bg || '#facc15', fg: color.fg || '#111827' };
        highlightAction.style.setProperty('--marker-bg', selectedColor.bg);
        highlightAction.style.setProperty('--marker-fg', selectedColor.fg);
        colorActions.forEach((entry) => entry.setAttribute('aria-pressed', String(entry.dataset.bg === selectedColor.bg)));
      };
      const placePopover = (range) => {
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) return hide();
        popover.style.left = '0px';
        popover.style.top = '0px';
        popover.classList.add('open');
        const width = popover.offsetWidth || 176;
        const height = popover.offsetHeight || 42;
        const margin = 10;
        const center = rect.left + rect.width / 2;
        const left = Math.max(margin, Math.min(window.innerWidth - width - margin, center - width / 2));
        const showBelow = rect.top < height + 18;
        const top = showBelow ? Math.min(window.innerHeight - height - margin, rect.bottom + 12) : Math.max(margin, rect.top - height - 12);
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';
        popover.style.setProperty('--arrow-left', Math.max(18, Math.min(width - 18, center - left)) + 'px');
        popover.classList.toggle('below', showBelow);
      };
      colorActions.forEach((button) => {
        button.addEventListener('click', () => {
          setSelectedColor({ bg: button.dataset.bg, fg: button.dataset.fg });
          colorMenu.classList.remove('open');
          colorToggle.setAttribute('aria-expanded', 'false');
        });
      });
      colorToggle.addEventListener('click', () => {
        const open = !colorMenu.classList.contains('open');
        colorMenu.classList.toggle('open', open);
        colorToggle.setAttribute('aria-expanded', String(open));
      });
      window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin || event.data?.type !== 'bitlibrary-highlight-color') return;
        setSelectedColor(event.data.color || {});
      });
      document.addEventListener('selectionchange', () => {
        window.clearTimeout(hideTimer);
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return hide();
        const range = selection.getRangeAt(0);
        if (!article.contains(range.commonAncestorContainer)) return hide();
        savedRange = range.cloneRange();
        removeAction.classList.toggle('available', highlightsInRange(savedRange).length > 0);
        window.requestAnimationFrame(() => placePopover(savedRange));
      });
      popover.addEventListener('mousedown', (event) => event.preventDefault());
      highlightAction.addEventListener('click', () => {
        if (!savedRange || savedRange.collapsed) return hide();
        highlightRange(savedRange);
        window.getSelection()?.removeAllRanges();
        hide();
      });
      removeAction.addEventListener('click', () => {
        if (!savedRange || savedRange.collapsed) return hide();
        highlightsInRange(savedRange).forEach(unwrapHighlight);
        window.getSelection()?.removeAllRanges();
        hide();
      });
      readAction.addEventListener('click', () => {
        if (!savedRange || savedRange.collapsed) return hide();
        const text = savedRange.toString().replace(/\\s+/g, ' ').trim();
        if (text) window.parent?.postMessage({ type: 'bitlibrary-read-selection', text }, window.location.origin);
        hide();
      });
      document.addEventListener('mousedown', (event) => {
        if (!popover.contains(event.target)) hideTimer = window.setTimeout(hide, 150);
      });
      window.addEventListener('resize', hide);
      window.addEventListener('scroll', hide, true);
    })();`;

const safeHref = (value: string) => {
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  if (/^\/[\w./%?#=&+@~,-]+$/i.test(value)) return value;
  if (/^[\w.-]+@[\w.-]+\.\w+$/i.test(value)) return `mailto:${value}`;
  if (/^[A-Za-z][\w.-]*$/.test(value)) return `#${value}`;
  return '';
};

const getXrefHref = (xml: string) => {
  const rid = getRidValues(xml).map(anchorIdFromValue).find(Boolean);
  if (rid) return `#${rid}`;
  return safeHref(getHrefAttribute(xml));
};

const renderTexMath = (xml: string, displayMode = false) => {
  const tex = xmlToPlainText(xml);
  if (!tex) return '';
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return `<code class="math">${escapeHtml(tex)}</code>`;
  }
};

const renderMathMl = (xml: string) => {
  let math = xml
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+=["'][^"']*["']/gi, '')
    .replace(/\s(?:href|xlink:href)=["']javascript:[^"']*["']/gi, '')
    .replace(/(<\/?)mml:/gi, '$1')
    .replace(/\sxmlns:mml=["'][^"']*["']/gi, '');
  if (!/<math[\s>]/i.test(math)) math = `<math xmlns="http://www.w3.org/1998/Math/MathML">${math}</math>`;
  return `<span class="mathml-render">${math}</span>`;
};

const renderMathMlFallback = (xml: string) => {
  const text = xmlToPlainText(xml);
  return text ? `<code class="math mathml-fallback">${escapeHtml(text)}</code>` : '';
};

const renderFormulaXml = (xml: string, displayMode = false) => {
  const texMatch = xml.match(/<tex-math\b[^>]*>([\s\S]*?)<\/tex-math>/i);
  if (texMatch) return renderTexMath(texMatch[1], displayMode);
  const mathMlMatch = xml.match(/<(?:mml:)?math\b[^>]*>([\s\S]*?)<\/(?:mml:)?math>/i);
  if (mathMlMatch) return renderMathMl(mathMlMatch[0]);
  return renderXmlInline(xml);
};

const renderXmlInline = (xml: string): string => {
  const parts: string[] = [];
  const stash = (html: string) => {
    const token = `@@BITLIB_HTML_${parts.length}@@`;
    parts.push(html);
    return token;
  };
  let value = xml
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<inline-(?:graphic|media)\b[^>]*\/>/gi, (full) => {
      const href = getHrefAttribute(full);
      return stash(`<span class="inline-media">${escapeHtml(getFileName(href) || href || 'inline media')}</span>`);
    })
    .replace(/<break\s*\/?>/gi, () => stash('<br>'));

  const replaceTag = (tag: string, render: (inner: string, full: string) => string) => {
    const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let previous = '';
    while (previous !== value) {
      previous = value;
      value = value.replace(pattern, (full, inner) => stash(render(inner, full)));
    }
  };

  replaceTag('italic', (inner) => `<em>${renderXmlInline(inner)}</em>`);
  replaceTag('bold', (inner) => `<strong>${renderXmlInline(inner)}</strong>`);
  replaceTag('sub', (inner) => `<sub>${renderXmlInline(inner)}</sub>`);
  replaceTag('sup', (inner) => `<sup>${renderXmlInline(inner)}</sup>`);
  replaceTag('sc', (inner) => `<span class="small-caps">${renderXmlInline(inner)}</span>`);
  replaceTag('monospace', (inner) => `<code>${renderXmlInline(inner)}</code>`);
  replaceTag('list', (inner) => `<ul>${renderXmlInline(inner)}</ul>`);
  replaceTag('list-item', (inner) => `<li>${renderXmlInline(inner.replace(/<label\b[^>]*>[\s\S]*?<\/label>/gi, ''))}</li>`);
  replaceTag('email', (inner) => {
    const email = xmlToPlainText(inner);
    return email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : '';
  });
  replaceTag('ext-link', (inner, full) => {
    const href = safeHref(getHrefAttribute(full));
    const label = renderXmlInline(inner);
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label || escapeHtml(href)}</a>` : label;
  });
  replaceTag('uri', (inner, full) => {
    const href = safeHref(getHrefAttribute(full) || xmlToPlainText(inner));
    const label = renderXmlInline(inner);
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label || escapeHtml(href)}</a>` : label;
  });
  replaceTag('xref', (inner, full) => {
    const href = getXrefHref(full);
    const label = renderXmlInline(inner);
    return href ? `<a class="xref" href="${escapeHtml(href)}">${label}</a>` : `<span class="xref">${label}</span>`;
  });
  replaceTag('named-content', (inner) => `<span>${renderXmlInline(inner)}</span>`);
  replaceTag('styled-content', (inner) => `<span>${renderXmlInline(inner)}</span>`);
  replaceTag('inline-formula', (inner) => `<span class="formula">${renderFormulaXml(inner, false)}</span>`);
  replaceTag('disp-formula', (inner) => `<div class="formula formula-block">${renderFormulaXml(inner, true)}</div>`);
  replaceTag('tex-math', (inner) => renderTexMath(inner, false));
  replaceTag('mml:math', (_inner, full) => renderMathMl(full));
  replaceTag('math', (_inner, full) => renderMathMl(full));

  value = value.replace(/<\/?[^>]+>/g, ' ');
  return escapeText(decodeXmlText(value)).replace(/@@BITLIB_HTML_(\d+)@@/g, (_, index) => parts[Number(index)] || '');
};

const formatBioCName = (value: string) => {
  const surname = value.match(/surname:([^;]+)/i)?.[1]?.trim();
  const given = value.match(/given-names:([^;]+)/i)?.[1]?.trim();
  return [given, surname].filter(Boolean).join(' ') || value;
};

const getFileName = (value: string) => {
  try {
    return decodeURIComponent(new URL(value, 'https://pmc.ncbi.nlm.nih.gov').pathname.split('/').pop() || '').toLowerCase();
  } catch {
    return value.split(/[?#]/)[0].split('/').pop()?.toLowerCase() || '';
  }
};

const getCloudPmcAssetUrl = (xml: string) => {
  const path = xml.match(/<\?cloudpmc-path\s+([\s\S]*?)\?>/i)?.[1]?.trim();
  if (!path || !/\.(?:avif|gif|jpe?g|png|svg|webp|tiff?)(?:$|[?#])/i.test(path)) return '';
  const bucket = xml.match(/<\?cloudpmc-bucket\s+([\s\S]*?)\?>/i)?.[1]?.trim().toLowerCase();
  const cleanPath = path.replace(/^\/+/, '');
  if (bucket === 'cdn' || cleanPath.startsWith('blobs/')) return `https://cdn.ncbi.nlm.nih.gov/pmc/${cleanPath}`;
  return '';
};

const getPmcInstanceAssetUrl = (pmc: string, fileName: string) => {
  const pmcNumber = pmc.match(/^PMC(\d+)$/i)?.[1];
  if (!pmcNumber || !/\.(?:avif|gif|jpe?g|png|svg|webp|tiff?)$/i.test(fileName)) return '';
  return `https://pmc.ncbi.nlm.nih.gov/articles/instance/${encodeURIComponent(pmcNumber)}/bin/${encodeURIComponent(fileName)}`;
};

const renderFigureImage = (imageUrl: string, caption: string, label: string) => {
  const alt = (caption || label || 'Article figure').replace(/\s+/g, ' ').trim().slice(0, 260);
  return imageUrl
    ? `<a class="figure-open" href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener noreferrer"><span class="figure-image-shell"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async"><span class="figure-zoom">Open full image</span></span></a>`
    : `<div class="figure-missing" role="note">Image file is listed in the source XML but was not available from PMC.</div>`;
};

const getBioCPmcId = (body: string) => {
  const frontXml = body.match(/<passage\b[^>]*>[\s\S]*?<infon\s+key=["']type["']>front<\/infon>[\s\S]*?<\/passage>/i)?.[0] || '';
  const value = getInfonValue(frontXml, 'article-id_pmc') || getTagText(body, 'id');
  if (/^PMC\d+$/i.test(value)) return value.toUpperCase();
  if (/^\d+$/.test(value)) return `PMC${value}`;
  return value;
};

const getJatsPmcId = (body: string) => {
  const match = body.match(/<article-id\b[^>]*pub-id-type=["']pmcid["'][^>]*>([\s\S]*?)<\/article-id>/i);
  const value = match ? xmlToPlainText(match[1]) : '';
  if (/^PMC\d+$/i.test(value)) return value.toUpperCase();
  if (/^\d+$/.test(value)) return `PMC${value}`;
  return '';
};

const isBioCReaderSource = (target: URL, body: string) => (
  /\/BioC_xml\//i.test(target.pathname)
  || (
    /(?:^|\.)ncbi\.nlm\.nih\.gov$/i.test(target.hostname)
    && /<collection[\s>]/i.test(body)
    && /<passage[\s>]/i.test(body)
    && /^PMC\d+$/i.test(getBioCPmcId(body))
  )
);

const fetchPmcImageMap = async (pmc: string): Promise<Record<string, string>> => {
  if (!/^PMC\d+$/i.test(pmc)) return {};
  try {
    const response = await fetch(`https://pmc.ncbi.nlm.nih.gov/articles/${encodeURIComponent(pmc)}/`, {
      headers: {
        accept: 'text/html,application/xhtml+xml,*/*',
        'user-agent': 'BitLibrary/0.5.0 (reader image discovery)',
      },
    });
    if (!response.ok) return {};
    const html = await response.text();
    const imageMap: Record<string, string> = {};
    const addImage = (value: string) => {
      if (!value || !/\.(?:avif|gif|jpe?g|png|svg|webp|tiff?)(?:$|[?#&])/i.test(value)) return;
      const absoluteUrl = new URL(decodeXmlText(value).replace(/&amp;/g, '&'), `https://pmc.ncbi.nlm.nih.gov/articles/${pmc}/`).toString();
      const fileName = getFileName(absoluteUrl);
      if (fileName) imageMap[fileName] = absoluteUrl;
    };
    Array.from(html.matchAll(/<(?:img|a)\b[^>]*\b(?:src|href|data-largeobj|data-image-url)=["']([^"']+)["'][^>]*>/gi)).forEach((match) => {
      addImage(match[1]);
    });
    Array.from(html.matchAll(/https?:\/\/[^"'\s<>]+?\.(?:avif|gif|jpe?g|png|svg|webp|tiff?)(?:\?[^"'\s<>]*)?/gi)).forEach((match) => {
      addImage(match[0]);
    });
    return imageMap;
  } catch {
    return {};
  }
};

const renderSimpleXmlTable = (xml: string) => {
  const decoded = decodeXmlText(xml);
  const rows = Array.from(decoded.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map((rowMatch) => (
    Array.from(rowMatch[1].matchAll(/<(t[dh])\b[^>]*>([\s\S]*?)<\/\1>/gi))
      .map((cellMatch) => ({
        tag: cellMatch[1].toLowerCase() === 'th' ? 'th' : 'td',
        attrs: getCellAttributes(cellMatch[0]),
        html: renderXmlInline(cellMatch[2]).replace(/\s+/g, ' ').trim(),
      }))
      .filter((cell) => cell.html)
  )).filter((row) => row.length > 0);
  if (rows.length === 0) return '';

  return `<div class="table-wrap"><table>${rows.map((row, rowIndex) => (
    `<tr>${row.map((cell) => {
      const tag = rowIndex === 0 && cell.tag === 'td' ? 'th' : cell.tag;
      return `<${tag}${cell.attrs}>${enhanceBioCText(cell.html)}</${tag}>`;
    }).join('')}</tr>`
  )).join('')}</table></div>`;
};

const getBioCXrefAnchor = (kind: string, label: string, anchors: Record<string, string>) => {
  const normalizedKind = /^tab/i.test(kind) ? 'Table' : /^fig/i.test(kind) ? 'Fig' : '';
  const normalizedLabel = label.replace(/[()]/g, '').trim();
  if (!normalizedKind || !normalizedLabel) return '';
  const exactAnchor = anchors[`${normalizedKind}:${normalizedLabel.toLowerCase()}`];
  if (exactAnchor) return exactAnchor;
  const parentFigureLabel = normalizedKind === 'Fig' ? normalizedLabel.match(/^([A-Z]?\d+(?:\.\d+)?)[A-Za-z]$/)?.[1] : '';
  return parentFigureLabel ? anchors[`${normalizedKind}:${parentFigureLabel.toLowerCase()}`] || '' : '';
};

const enhanceBioCText = (value: string, xrefAnchors: Record<string, string> = {}) => {
  const hasInlineHtml = value.includes('<') && value.includes('>');
  const escaped = hasInlineHtml ? value : escapeText(value);
  const enhanced = hasInlineHtml ? escaped : escaped
    .replace(/(https?:\/\/[^\s<>"']+)/g, (match) => {
      const trailing = match.match(/[),.;:]+$/)?.[0] || '';
      const href = match.slice(0, match.length - trailing.length);
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>${trailing}`;
    })
    .replace(/\bdoi:\s*(10\.\d{4,9}\/[^\s<>"']+)/gi, (match, doiValue) => {
      const trailing = doiValue.match(/[),.;:]+$/)?.[0] || '';
      const doi = doiValue.slice(0, doiValue.length - trailing.length);
      return `DOI: <a href="https://doi.org/${doi}" target="_blank" rel="noopener noreferrer">${doi}</a>${trailing}`;
    });
  return enhanced
    .replace(/\b(Figure|Fig\.|Table)\s+(\(?[A-Z]?\d+[A-Za-z]?(?:\.\d+)?\)?)/g, (match, kind, label) => {
      const anchor = getBioCXrefAnchor(kind, label, xrefAnchors);
      return anchor ? `<a class="xref" href="#${escapeHtml(anchor)}">${match}</a>` : `<mark>${match}</mark>`;
    })
    .replace(/\b(Equation|Eq\.|Section|Appendix|Ref\.|Refs\.)\s+(\(?[A-Z]?\d+[A-Za-z]?(?:\.\d+)?\)?)/g, '<mark>$1 $2</mark>')
    .replace(/^(\(\d+\))\s+/, '<strong class="claim">$1</strong> ');
};

const renderBioCArticleHtml = (body: string, contentType: string, imageMap: Record<string, string> = {}): string | null => {
  if (!/<collection[\s>]/i.test(body) || !/<passage[\s>]/i.test(body)) return null;

  const passages = Array.from(body.matchAll(/<passage\b[^>]*>([\s\S]*?)<\/passage>/gi)).map((match) => {
    const passageXml = match[1];
    return {
      type: getInfonValue(passageXml, 'type').toLowerCase(),
      section: getInfonValue(passageXml, 'section_type').toUpperCase(),
      text: getTagText(passageXml, 'text'),
      file: getInfonValue(passageXml, 'file'),
      xml: getInfonValue(passageXml, 'xml'),
      source: getInfonValue(passageXml, 'source'),
      year: getInfonValue(passageXml, 'year'),
      id: getInfonValue(passageXml, 'id'),
    };
  }).filter((passage) => passage.text);

  if (passages.length === 0) return null;

  const frontXml = body.match(/<passage\b[^>]*>[\s\S]*?<infon\s+key=["']type["']>front<\/infon>[\s\S]*?<\/passage>/i)?.[0] || '';
  const title = passages.find((passage) => passage.section === 'TITLE')?.text || 'Untitled article';
  const abstractPassages = passages.filter((passage) => passage.section === 'ABSTRACT');
  const doi = getInfonValue(frontXml, 'article-id_doi');
  const pmc = getBioCPmcId(body);
  const year = getInfonValue(frontXml, 'year');
  const keywords = getInfonValue(frontXml, 'kwd');
  const authors = Array.from(frontXml.matchAll(/<infon\s+key=["']name_\d+["']>([\s\S]*?)<\/infon>/gi))
    .map((match) => formatBioCName(decodeXmlText(match[1])))
    .filter(Boolean);
  const bodyPassages = passages.filter((passage) => !['TITLE', 'ABSTRACT'].includes(passage.section));
  const captionByFile = new Map<string, string>();
  const titleByFile = new Map<string, string>();
  const tableFootByFile = new Map<string, string>();
  const xrefAnchors: Record<string, string> = {};
  bodyPassages.forEach((passage) => {
    const key = passage.file || passage.id;
    if (!key) return;
    if (passage.type === 'fig_title_caption') titleByFile.set(key, passage.text);
    if (['fig_caption', 'table_caption'].includes(passage.type)) captionByFile.set(key, passage.text);
    if (passage.type === 'table_foot') tableFootByFile.set(key, passage.text);
    const anchor = anchorIdFromValue(passage.id || passage.file);
    const numericLabel = (passage.id || passage.file).match(/\d+[A-Za-z]?/)?.[0]?.toLowerCase();
    if (anchor && numericLabel && passage.section === 'FIG') xrefAnchors[`Fig:${numericLabel}`] = anchor;
    if (anchor && numericLabel && passage.section === 'TABLE') xrefAnchors[`Table:${numericLabel}`] = anchor;
  });

  const isBioCTitleType = (type: string) => (
    type === 'title'
    || /^title_\d+$/i.test(type)
    || /_title_\d+$/i.test(type)
  );

  const isOptionalDisclosureTitle = (text: string) => (
    /^(?:consent\s+for\s+publication|competing\s+interests?|conflicts?\s+of\s+interest|publisher'?s\s+note)$/i.test(text.trim())
  );

  const renderableBodyPassages = bodyPassages.filter((passage, index, entries) => {
    if (passage.section === 'COMP_INT') return false;
    if (passage.type === 'footnote' && /^(?:publisher'?s\s+note|springer nature remains neutral\b)/i.test(passage.text.trim())) return false;
    if (isBioCTitleType(passage.type) && isOptionalDisclosureTitle(passage.text)) return false;

    const previousTitle = [...entries.slice(0, index)].reverse().find((entry) => isBioCTitleType(entry.type));
    if (
      previousTitle
      && isOptionalDisclosureTitle(previousTitle.text)
      && !isBioCTitleType(passage.type)
      && passage.section === previousTitle.section
    ) {
      return false;
    }

    return true;
  });

  const isTitlePassage = (passage: typeof passages[number]) => (
    isBioCTitleType(passage.type)
  );

  const renderBioCAbstractHtml = () => {
    if (abstractPassages.length === 0) return '';
    const contentHtml = abstractPassages
      .filter((passage) => passage.type !== 'front')
      .map((passage) => {
        const text = enhanceBioCText(renderXmlInline(passage.text), xrefAnchors);
        return isTitlePassage(passage) ? `<h3>${text}</h3>` : `<p>${text}</p>`;
      })
      .join('');
    return contentHtml ? `<section class="abstract"><div class="label">Abstract</div>${contentHtml}</section>` : '';
  };

  const renderPassage = (passage: typeof passages[number]) => {
    const text = enhanceBioCText(renderXmlInline(passage.text), xrefAnchors);
    if (/^title_[12]$/i.test(passage.type)) {
      const level = passage.type === 'title_1' ? 'h2' : 'h3';
      return `<${level}${anchorIdAttr(anchorIdFromValue(passage.id))}>${text}</${level}>`;
    }
    if (passage.type === 'title' || /_title_\d+$/i.test(passage.type)) {
      if (passage.section === 'REF') return '';
      return `<h2${anchorIdAttr(anchorIdFromValue(passage.id))}>${text}</h2>`;
    }
    const keyedPassage = passage.file || passage.id;
    if (passage.type === 'table_caption' && keyedPassage) return '';
    if (passage.type === 'table_foot' && keyedPassage) return '';
    if (passage.type === 'fig_caption' && keyedPassage && titleByFile.has(keyedPassage)) return '';
    if (passage.section === 'REF') {
      return `<li${anchorIdAttr(anchorIdFromValue(passage.id))}><p>${text}</p>${passage.source ? `<span>${escapeHtml(passage.source)}${passage.year ? `, ${escapeHtml(passage.year)}` : ''}</span>` : ''}</li>`;
    }
    if (passage.section === 'FIG' || passage.section === 'TABLE') {
      const fileName = getFileName(passage.file);
      const imageUrl = imageMap[fileName] || getCloudPmcAssetUrl(passage.xml) || getPmcInstanceAssetUrl(pmc, fileName);
      const tableHtml = passage.xml ? renderSimpleXmlTable(passage.xml) : '';
      const figureTitle = titleByFile.get(keyedPassage) || (passage.type === 'fig_title_caption' ? passage.text : '');
      const caption = captionByFile.get(keyedPassage) || (figureTitle || tableHtml ? '' : passage.text);
      const captionHtml = [
        figureTitle ? `<p><strong>${enhanceBioCText(renderXmlInline(figureTitle), xrefAnchors)}</strong></p>` : '',
        caption ? `<p>${enhanceBioCText(renderXmlInline(caption), xrefAnchors)}</p>` : '',
      ].filter(Boolean).join('');
      const tablePlainText = passage.section === 'TABLE' && passage.type === 'table' && !tableHtml ? `<p class="table-plain">${text}</p>` : '';
      const tableFoot = tableFootByFile.get(keyedPassage);
      const tableFootHtml = tableFoot ? `<p class="table-foot">${enhanceBioCText(renderXmlInline(tableFoot), xrefAnchors)}</p>` : '';
      const labelText = passage.id || passage.file || passage.section.toLowerCase();
      return `<aside${anchorIdAttr(anchorIdFromValue(passage.id || passage.file))} class="${passage.section === 'TABLE' ? 'table-card' : 'figure-card'}"><div class="label">${escapeHtml(labelText)}</div>${passage.section === 'FIG' ? renderFigureImage(imageUrl, caption || figureTitle, labelText) : ''}<div class="figure-caption">${captionHtml}</div>${tableHtml || tablePlainText}${tableFootHtml}</aside>`;
    }
    if (passage.type === 'footnote') return `<aside class="note"><strong>Note</strong><p>${text}</p></aside>`;
    return `<p>${text}</p>`;
  };

  const content: string[] = [];
  let inRefs = false;
  let inAbbrList = false;
  let pendingAbbrTerm = '';
  const closeAbbrList = () => {
    if (pendingAbbrTerm) {
      content.push(`<div><dt>${pendingAbbrTerm}</dt><dd></dd></div>`);
      pendingAbbrTerm = '';
    }
    if (inAbbrList) {
      content.push('</dl>');
      inAbbrList = false;
    }
  };
  renderableBodyPassages.forEach((passage) => {
    if (passage.section !== 'ABBR') closeAbbrList();
    if (passage.section === 'REF' && !inRefs) {
      content.push('<h2>References</h2><ol class="refs">');
      inRefs = true;
    }
    if (passage.section !== 'REF' && inRefs) {
      content.push('</ol>');
      inRefs = false;
    }
    if (passage.section === 'ABBR' && passage.type === 'paragraph') {
      if (!inAbbrList) {
        content.push('<dl class="abbr-list">');
        inAbbrList = true;
      }
      const text = enhanceBioCText(renderXmlInline(passage.text), xrefAnchors);
      if (!pendingAbbrTerm) {
        pendingAbbrTerm = text;
      } else {
        content.push(`<div><dt>${pendingAbbrTerm}</dt><dd>${text}</dd></div>`);
        pendingAbbrTerm = '';
      }
      return;
    }
    if (passage.section === 'ABBR') closeAbbrList();
    content.push(renderPassage(passage));
  });
  closeAbbrList();
  if (inRefs) content.push('</ol>');

  return stripLowPriorityDuplicateAnchorIds(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css"><style>
    :root{color-scheme:dark;background:#08090b;color:#f4f4f5;--panel:#14161a;--line:#2a2f36;--muted:#a1a1aa;--accent:#67e8f9}
    html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#0d1117 0,#08090b 300px);color:#f4f4f5;font:17px/1.72 ui-serif,Georgia,Cambria,"Times New Roman",serif}
    [id]{scroll-margin-top:24px}.reader-target-highlight{animation:target-flash 2.6s ease-out 1}.reader-target-highlight:is(h1,h2,h3,h4,h5,h6,p,li){border-radius:8px;background:linear-gradient(90deg,rgba(103,232,249,.1),rgba(103,232,249,.025) 70%,transparent)}aside.reader-target-highlight,.table-card.reader-target-highlight,.figure-card.reader-target-highlight{border-color:rgba(103,232,249,.42)!important;box-shadow:0 22px 70px rgba(0,0,0,.26),0 0 0 1px rgba(103,232,249,.32),0 0 34px rgba(103,232,249,.12)!important}@keyframes target-flash{0%,65%{outline:1px solid rgba(103,232,249,.62);outline-offset:6px}100%{outline:1px solid transparent;outline-offset:6px}}
    article{box-sizing:border-box;width:min(1120px,calc(100% - 40px));max-width:none;margin:0 auto;padding:34px 24px 72px}
    header{border:1px solid var(--line);background:rgba(20,22,26,.78);margin-bottom:30px;padding:24px;border-radius:10px}
    .label{color:var(--accent);font:700 11px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase}
    h1{margin:10px 0 14px;color:#fff;font:750 34px/1.14 ui-sans-serif,system-ui,sans-serif}
    h2{margin:38px 0 14px;border-top:1px solid var(--line);padding-top:24px;color:#fff;font:720 23px/1.25 ui-sans-serif,system-ui,sans-serif}
    h3{margin:26px 0 10px;color:#f4f4f5;font:700 18px/1.3 ui-sans-serif,system-ui,sans-serif}
    p{margin:0 0 18px;color:#e4e4e7}
    a{color:#67e8f9;text-decoration:underline;text-decoration-thickness:.08em;text-underline-offset:.18em}a:hover{color:#a5f3fc}
    mark{border-radius:4px;background:rgba(103,232,249,.14);color:#e0f2fe;padding:0 .18em}
    .claim{color:#f8fafc;font-family:ui-sans-serif,system-ui,sans-serif}
    img{display:block;max-width:100%;height:auto;margin:0 auto}
    .meta,.keywords{color:#a1a1aa;font:13px/1.55 ui-sans-serif,system-ui,sans-serif}
    .abstract{border:1px solid rgba(103,232,249,.28);border-left:4px solid var(--accent);background:rgba(103,232,249,.07);margin:24px 0 30px;padding:18px 20px;border-radius:8px}
    aside{border:1px solid var(--line);background:var(--panel);margin:24px 0;padding:16px 18px;border-radius:8px}
    aside .label{margin-bottom:8px} aside strong{color:#67e8f9;font:700 12px/1.4 ui-sans-serif,system-ui,sans-serif;text-transform:uppercase}
    .figure-card{overflow:hidden;padding:0;background:linear-gradient(180deg,rgba(24,28,34,.96),rgba(15,17,22,.98));border-radius:12px;box-shadow:0 22px 70px rgba(0,0,0,.26)}
    .figure-card>.label{display:inline-flex;margin:14px 16px 10px;border:1px solid rgba(103,232,249,.22);border-radius:999px;background:rgba(103,232,249,.08);padding:5px 9px}
    .figure-open{display:block;color:inherit!important;text-decoration:none!important}.figure-image-shell{position:relative;display:block;margin:0 14px 12px;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.1),rgba(255,255,255,.025) 46%,rgba(0,0,0,.2));box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
    .figure-image-shell img{width:100%;max-height:min(72vh,780px);object-fit:contain;background:#fff;padding:8px;box-sizing:border-box;transition:transform .25s ease}.figure-open:hover img{transform:scale(1.01)}
    .figure-zoom{position:absolute;right:12px;bottom:12px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(9,9,11,.82);backdrop-filter:blur(8px);color:#f4f4f5;font:700 10px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;padding:8px 10px;opacity:.92}
    .figure-caption{padding:0 16px 16px;color:#d4d4d8;font:14px/1.62 ui-sans-serif,system-ui,sans-serif}.figure-caption p{margin-bottom:10px;color:inherit}.figure-missing{margin:0 16px 14px;border:1px dashed rgba(161,161,170,.45);border-radius:10px;background:rgba(255,255,255,.035);padding:18px;color:#a1a1aa;font:13px/1.5 ui-sans-serif,system-ui,sans-serif;text-align:center}
    .note{border-left:3px solid #a78bfa}.abbr-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:0;margin:10px 0 24px;border:1px solid var(--line);border-radius:8px;background:rgba(20,22,26,.52);overflow:hidden}.abbr-list div{display:grid;grid-template-columns:minmax(58px,.38fr) minmax(0,1fr);gap:10px;border-top:1px solid rgba(255,255,255,.06);padding:9px 12px}.abbr-list div:nth-child(1),.abbr-list div:nth-child(2){border-top:0}.abbr-list div:nth-child(even){border-left:1px solid rgba(255,255,255,.06)}.abbr-list dt{color:#f8fafc;font:750 12px/1.4 ui-sans-serif,system-ui,sans-serif}.abbr-list dd{margin:0;color:#d4d4d8;font:13px/1.42 ui-sans-serif,system-ui,sans-serif}@media (max-width:720px){.abbr-list{grid-template-columns:1fr}.abbr-list div:nth-child(2){border-top:1px solid rgba(255,255,255,.06)}.abbr-list div:nth-child(even){border-left:0}}.table-wrap{margin-top:12px;overflow:auto;border:1px solid var(--line);border-radius:6px}.table-wrap ul{margin:0;padding-left:18px}.table-wrap li{margin:0 0 6px}.table-wrap li:last-child{margin-bottom:0}
    table{width:100%;border-collapse:collapse;font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
    th,td{border:1px solid #3f3f46;padding:9px 11px;text-align:left;vertical-align:top}th{background:#27272a;color:#f4f4f5;position:sticky;top:0}
    tbody tr:nth-child(even) td{background:rgba(255,255,255,.025)}
    .refs{padding-left:22px;color:#d4d4d8;font-size:14px;line-height:1.55}
    .refs li{margin-bottom:12px}.refs li p{margin-bottom:4px}.refs span{color:#a1a1aa}
    ${readerSelectionStyle}
  </style></head><body>${readerSelectionToolbarHtml}<article data-reader-content="true"><header><div class="label">BioC full text</div><h1>${renderXmlInline(title)}</h1><div class="meta">${escapeHtml(authors.join(', ') || 'Unknown authors')}${year ? ` &middot; ${escapeHtml(year)}` : ''}${pmc ? ` &middot; ${escapeHtml(pmc)}` : ''}${doi ? ` &middot; DOI ${escapeHtml(doi)}` : ''}</div>${keywords ? `<div class="keywords">${escapeHtml(keywords)}</div>` : ''}</header>${renderBioCAbstractHtml()}${content.join('')}</article><script>
    (() => {
      const concreteIds = new Set();
      document.querySelectorAll('[id]').forEach((node) => {
        if (!/^(H[1-6]|UL|OL)$/.test(node.tagName)) concreteIds.add(node.id);
      });
      document.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id],ul[id],ol[id]').forEach((node) => {
        if (concreteIds.has(node.id)) node.removeAttribute('id');
      });
    })();
    ${readerTargetHighlightScript}
    ${readerSelectionScript}
  </script></body></html>`);
};

const getXmlInner = (xml: string, tagName: string) => {
  const match = xml.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match?.[1] || '';
};

const xmlToPlainText = (xml: string) => (
  decodeXmlText(xml).replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const renderJatsParagraph = (xml: string, anchorXml = '') => {
  const html = renderXmlInline(xml).trim();
  return html ? `<p${anchorIdAttr(getXmlId(anchorXml || xml))}>${enhanceBioCText(html)}</p>` : '';
};

const renderJatsCaption = (xml: string) => {
  const title = renderXmlInline(getXmlInner(xml, 'title')).trim();
  const paragraphs = Array.from(xml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => renderXmlInline(match[1]).trim())
    .filter(Boolean)
    .map((text) => `<p>${enhanceBioCText(text)}</p>`)
    .join('');
  return `${title ? `<strong>${enhanceBioCText(title)}</strong>` : ''}${paragraphs}`;
};

const renderJatsTable = (xml: string) => {
  const label = xmlToPlainText(getXmlInner(xml, 'label'));
  const caption = renderJatsCaption(getXmlInner(xml, 'caption'));
  const tableXml = getXmlInner(xml, 'table');
  const rows = Array.from(tableXml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((rowMatch) => (
      Array.from(rowMatch[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi))
        .map((cellMatch) => ({
          tag: cellMatch[1].toLowerCase() === 'th' ? 'th' : 'td',
          attrs: getCellAttributes(cellMatch[0]),
          html: renderXmlInline(cellMatch[2]).trim(),
        }))
        .filter((cell) => cell.html)
    ))
    .filter((row) => row.length > 0);
  if (rows.length === 0 && !caption) return '';

  const table = rows.length > 0
    ? `<div class="table-wrap"><table>${rows.map((row) => `<tr>${row.map((cell) => `<${cell.tag}${cell.attrs}>${enhanceBioCText(cell.html)}</${cell.tag}>`).join('')}</tr>`).join('')}</table></div>`
    : '';
  return `<aside${anchorIdAttr(getXmlId(xml))} class="table-card">${label ? `<div class="label">${escapeHtml(label)}</div>` : ''}${caption}${table}</aside>`;
};

const getJatsGraphicUrl = (xml: string, imageMap: Record<string, string>, pmc = '') => {
  const graphic = xml.match(/<graphic\b[^>]*>/i)?.[0] || xml.match(/<media\b[^>]*>/i)?.[0] || '';
  const href = getHrefAttribute(graphic);
  const cloudUrl = getCloudPmcAssetUrl(xml);
  if (cloudUrl) return cloudUrl;
  if (!href) return '';
  const externalHref = safeHref(href);
  if (externalHref && /\.(?:avif|gif|jpe?g|png|svg|webp|tiff?)(?:$|[?#])/i.test(externalHref)) return externalHref;
  const fileName = getFileName(href);
  return imageMap[fileName]
    || imageMap[getFileName(decodeXmlText(href))]
    || getPmcInstanceAssetUrl(pmc, fileName);
};

const renderJatsFigure = (xml: string, imageMap: Record<string, string>, pmc = '') => {
  const label = xmlToPlainText(getXmlInner(xml, 'label'));
  const caption = renderJatsCaption(getXmlInner(xml, 'caption'));
  const captionText = xmlToPlainText(getXmlInner(xml, 'caption'));
  const imageUrl = getJatsGraphicUrl(xml, imageMap, pmc);
  return (caption || imageUrl) ? `<aside${anchorIdAttr(getXmlId(xml))} class="figure-card">${label ? `<div class="label">${escapeHtml(label)}</div>` : ''}${renderFigureImage(imageUrl, captionText, label)}${caption ? `<div class="figure-caption">${caption}</div>` : ''}</aside>` : '';
};

const renderJatsFormulaBlock = (xml: string) => {
  const label = xmlToPlainText(getXmlInner(xml, 'label'));
  const html = renderFormulaXml(xml, true).trim();
  return html ? `<div${anchorIdAttr(getXmlId(xml))} class="formula formula-block">${label ? `<div class="label">${escapeHtml(label)}</div>` : ''}${html}</div>` : '';
};

const xmlToPreformattedText = (xml: string) => (
  decodeXmlText(xml)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/^\n+|\n+$/g, '')
);

const parseMermaidNode = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^([A-Za-z][\w-]*)(?:\[(.*?)\]|\{(.*?)\}|\((.*?)\))?$/);
  if (!match) return { id: trimmed, label: trimmed, kind: 'node' };
  return {
    id: match[1],
    label: match[2] || match[3] || match[4] || match[1],
    kind: match[3] ? 'decision' : 'node',
  };
};

const renderFlowchartSource = (source: string, anchorId = '') => {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const direction = lines.find((line) => /^(?:flowchart|graph)\s+/i.test(line)) || 'flowchart';
  const edges = lines
    .filter((line) => /-->|---|==>/.test(line))
    .map((line) => line.split(/-->|---|==>/).map(parseMermaidNode))
    .filter((nodes) => nodes.length >= 2);
  if (edges.length === 0) return '';
  const nodeLabels = new Map<string, { label: string; kind: string }>();
  edges.flat().forEach((node) => {
    if (!nodeLabels.has(node.id) || node.label !== node.id) nodeLabels.set(node.id, { label: node.label, kind: node.kind });
  });
  const resolveNode = (node: ReturnType<typeof parseMermaidNode>) => nodeLabels.get(node.id) || node;

  return `<aside${anchorIdAttr(anchorId)} class="flowchart-card"><div class="label">${escapeHtml(direction)}</div><div class="flowchart-steps">${edges.map((nodes) => (
    nodes.slice(0, 2).map((node, index) => {
      const resolved = resolveNode(node);
      return `${index > 0 ? '<span class="flow-arrow">↓</span>' : ''}<span class="flow-node ${resolved.kind === 'decision' ? 'flow-decision' : ''}">${escapeHtml(resolved.label)}</span>`;
    }).join('')
  )).join('')}</div><pre class="code-block" data-language="mermaid"><code>${escapeHtml(source)}</code></pre></aside>`;
};

const renderJatsCodeBlock = (xml: string) => {
  const language = getXmlAttribute(xml, 'language') || getXmlAttribute(xml, 'preformat-type');
  const text = xmlToPreformattedText(xml);
  const anchor = anchorIdAttr(getXmlId(xml));
  if (/^(?:mermaid|flowchart)$/i.test(language) || /^(?:flowchart|graph)\s+/i.test(text.trim())) {
    return renderFlowchartSource(text, getXmlId(xml)) || `<pre${anchor} class="code-block" data-language="flowchart"><code>${escapeHtml(text)}</code></pre>`;
  }
  return text ? `<pre${anchor} class="code-block"${language ? ` data-language="${escapeHtml(language)}"` : ''}><code>${escapeHtml(text)}</code></pre>` : '';
};

const renderJatsBoxedText = (xml: string, imageMap: Record<string, string>, pmc = '') => {
  const caption = renderJatsCaption(getXmlInner(xml, 'caption'));
  const inner = xml.replace(/^<boxed-text\b[^>]*>/i, '').replace(/<\/boxed-text>\s*$/i, '');
  const body = renderJatsBlocks(inner.replace(/<caption\b[^>]*>[\s\S]*?<\/caption>/i, ''), imageMap, pmc);
  return caption || body ? `<aside${anchorIdAttr(getXmlId(xml))} class="boxed-text">${caption}${body}</aside>` : '';
};

const renderJatsChemStruct = (xml: string, imageMap: Record<string, string>, pmc = '') => {
  const label = xmlToPlainText(getXmlInner(xml, 'label')) || 'Chemical structure';
  const caption = renderJatsCaption(getXmlInner(xml, 'caption')) || renderJatsCaption(getXmlInner(xml, 'chem-struct-wrap'));
  const captionText = xmlToPlainText(getXmlInner(xml, 'caption')) || xmlToPlainText(getXmlInner(xml, 'chem-struct-wrap'));
  const imageUrl = getJatsGraphicUrl(xml, imageMap, pmc);
  const text = xmlToPlainText(xml).replace(label, '').trim();
  return caption || imageUrl || text
    ? `<aside${anchorIdAttr(getXmlId(xml))} class="chem-card"><div class="label">${escapeHtml(label)}</div>${imageUrl ? renderFigureImage(imageUrl, captionText, label) : ''}<div class="figure-caption">${caption || `<p>${escapeHtml(text)}</p>`}</div></aside>`
    : '';
};

const renderJatsSupplementary = (xml: string, imageMap: Record<string, string>, pmc = '') => {
  const label = xmlToPlainText(getXmlInner(xml, 'label')) || 'Supplementary material';
  const caption = renderJatsCaption(getXmlInner(xml, 'caption'));
  const imageUrl = getJatsGraphicUrl(xml, imageMap, pmc);
  const mediaTag = xml.match(/<(?:media|graphic|inline-media|inline-graphic)\b[^>]*>/i)?.[0] || '';
  const href = getHrefAttribute(mediaTag);
  const fileUrl = imageUrl || (href && /^PMC\d+$/i.test(pmc) ? `https://pmc.ncbi.nlm.nih.gov/articles/${encodeURIComponent(pmc)}/bin/${encodeURIComponent(href)}` : safeHref(href));
  const isImage = /\.(?:avif|gif|jpe?g|png|svg|webp|tiff?)(?:$|[?#])/i.test(fileUrl);
  const preview = isImage ? renderFigureImage(fileUrl, xmlToPlainText(getXmlInner(xml, 'caption')), label) : '';
  const link = fileUrl ? `<a class="resource-link" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">Open ${escapeHtml(getFileName(fileUrl) || 'file')}</a>` : '';
  return (caption || preview || link)
    ? `<aside${anchorIdAttr(getXmlId(xml))} class="resource-card"><div class="label">${escapeHtml(label)}</div>${preview}${caption ? `<div class="figure-caption">${caption}</div>` : ''}${link}</aside>`
    : '';
};

const renderJatsList = (xml: string) => {
  const items = Array.from(xml.matchAll(/<list-item\b[^>]*>([\s\S]*?)<\/list-item>/gi))
    .map((match) => ({ text: renderXmlInline(match[1]).trim(), id: getXmlId(match[0]) }))
    .filter((item) => item.text)
    .map((item) => `<li${anchorIdAttr(item.id)}>${enhanceBioCText(item.text)}</li>`)
    .join('');
  const listId = getXmlId(xml);
  return items ? `<ul${anchorIdAttr(hasDescendantXmlId(xml, listId) ? '' : listId)}>${items}</ul>` : '';
};

const renderJatsReferences = (xml: string) => {
  const refs = Array.from(xml.matchAll(/<ref\b[^>]*>([\s\S]*?)<\/ref>/gi))
    .map((match) => ({
      text: renderXmlInline(getXmlInner(match[1], 'mixed-citation') || match[1]).trim(),
      id: getXmlId(match[0]),
    }))
    .filter((ref) => ref.text)
    .map((ref) => `<li${anchorIdAttr(ref.id)}>${enhanceBioCText(ref.text)}</li>`)
    .join('');
  return refs ? `<h2>References</h2><ol class="refs">${refs}</ol>` : '';
};

const renderJatsFrontMatter = (xml: string) => {
  const affiliations = Array.from(xml.matchAll(/<aff\b[^>]*>([\s\S]*?)<\/aff>/gi))
    .map((match) => renderXmlInline(match[1]).trim())
    .filter(Boolean)
    .map((item) => `<li>${item}</li>`)
    .join('');
  const authorNotes = Array.from(getXmlInner(xml, 'author-notes').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => renderXmlInline(match[1]).trim())
    .filter(Boolean)
    .map((item) => `<p>${item}</p>`)
    .join('');
  const permissionsXml = getXmlInner(xml, 'permissions');
  const copyright = renderXmlInline(getXmlInner(permissionsXml, 'copyright-statement')).trim();
  const license = Array.from(permissionsXml.matchAll(/<license-p\b[^>]*>([\s\S]*?)<\/license-p>/gi))
    .map((match) => renderXmlInline(match[1]).trim())
    .filter(Boolean)
    .map((item) => `<p>${item}</p>`)
    .join('');
  const history = Array.from(xml.matchAll(/<notes\b[^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/notes>/gi))
    .map((match) => renderXmlInline(match[1]).trim())
    .filter(Boolean)
    .map((item) => `<p>${item}</p>`)
    .join('');
  const blocks = [
    affiliations ? `<section><div class="label">Affiliations</div><ul>${affiliations}</ul></section>` : '',
    authorNotes ? `<section><div class="label">Author notes</div>${authorNotes}</section>` : '',
    copyright || license ? `<section><div class="label">License</div>${copyright ? `<p>${copyright}</p>` : ''}${license}</section>` : '',
    history ? `<section><div class="label">History</div>${history}</section>` : '',
  ].filter(Boolean).join('');
  return blocks ? `<aside class="metadata-card">${blocks}</aside>` : '';
};

const renderJatsBlocks = (xml: string, imageMap: Record<string, string> = {}, pmc = ''): string => {
  const blockPattern = /<(sec|p|table-wrap|fig|list|ref-list|disp-formula|supplementary-material|media|preformat|code|boxed-text|chem-struct)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks = Array.from(xml.matchAll(blockPattern)).map((match) => {
    const tag = match[1].toLowerCase();
    const blockXml = match[0];
    const inner = match[2];
    if (tag === 'sec') {
      const sectionTitle = renderXmlInline(getXmlInner(inner, 'title')).trim();
      const withoutTitle = inner.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '');
      const sectionId = getXmlId(blockXml);
      return `${sectionTitle ? `<h2${anchorIdAttr(hasDescendantXmlId(blockXml, sectionId) ? '' : sectionId)}>${enhanceBioCText(sectionTitle)}</h2>` : ''}${renderJatsBlocks(withoutTitle, imageMap, pmc)}`;
    }
    if (tag === 'p') return renderJatsParagraph(inner, blockXml);
    if (tag === 'table-wrap') return renderJatsTable(blockXml);
    if (tag === 'fig') return renderJatsFigure(blockXml, imageMap, pmc);
    if (tag === 'list') return renderJatsList(blockXml);
    if (tag === 'ref-list') return renderJatsReferences(blockXml);
    if (tag === 'disp-formula') return renderJatsFormulaBlock(blockXml);
    if (tag === 'supplementary-material' || tag === 'media') return renderJatsSupplementary(blockXml, imageMap, pmc);
    if (tag === 'preformat' || tag === 'code') return renderJatsCodeBlock(blockXml);
    if (tag === 'boxed-text') return renderJatsBoxedText(blockXml, imageMap, pmc);
    if (tag === 'chem-struct') return renderJatsChemStruct(blockXml, imageMap, pmc);
    return '';
  }).filter(Boolean);
  return blocks.join('') || renderJatsParagraph(xml);
};

const renderJatsArticleHtml = (body: string, target: URL, imageMap: Record<string, string> = {}): string | null => {
  if (!/<article[\s>]/i.test(body) || !/<article-title[\s>]/i.test(body)) return null;

  const titleXml = getXmlInner(body, 'article-title');
  const title = xmlToPlainText(titleXml) || 'Untitled article';
  const titleHtml = renderXmlInline(titleXml) || escapeHtml(title);
  const journal = xmlToPlainText(getXmlInner(body, 'journal-title'));
  const year = xmlToPlainText(getXmlInner(getXmlInner(body, 'pub-date'), 'year'));
  const doiMatch = body.match(/<article-id\b[^>]*pub-id-type=["']doi["'][^>]*>([\s\S]*?)<\/article-id>/i);
  const pmcMatch = body.match(/<article-id\b[^>]*pub-id-type=["']pmcid["'][^>]*>([\s\S]*?)<\/article-id>/i);
  const doi = doiMatch ? xmlToPlainText(doiMatch[1]) : '';
  const pmc = pmcMatch ? xmlToPlainText(pmcMatch[1]) : '';
  const authors = Array.from(body.matchAll(/<contrib\b[^>]*>[\s\S]*?<name\b[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/contrib>/gi))
    .map((match) => {
      const nameXml = match[1];
      const given = xmlToPlainText(getXmlInner(nameXml, 'given-names'));
      const surname = xmlToPlainText(getXmlInner(nameXml, 'surname'));
      return [given, surname].filter(Boolean).join(' ');
    })
    .filter(Boolean);
  const abstractHtml = renderJatsBlocks(getXmlInner(body, 'abstract'), imageMap, pmc);
  const frontMatterHtml = renderJatsFrontMatter(getXmlInner(body, 'front'));
  const bodyXml = getXmlInner(body, 'body');
  const sectionHtml = renderJatsBlocks(bodyXml, imageMap, pmc);
  const backHtml = renderJatsReferences(getXmlInner(body, 'back'));
  const label = /(?:^|\.)ebi\.ac\.uk$/i.test(target.hostname) ? 'Europe PMC full text' : 'Full text XML';

  return stripLowPriorityDuplicateAnchorIds(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css"><style>
    :root{color-scheme:dark;background:#09090b;color:#f4f4f5}
    html{scroll-behavior:smooth}body{margin:0;background:#09090b;color:#f4f4f5;font:17px/1.72 ui-serif,Georgia,Cambria,"Times New Roman",serif}
    [id]{scroll-margin-top:24px}.reader-target-highlight{animation:target-flash 2.6s ease-out 1}.reader-target-highlight:is(h1,h2,h3,h4,h5,h6,p,li){border-radius:8px;background:linear-gradient(90deg,rgba(103,232,249,.1),rgba(103,232,249,.025) 70%,transparent)}aside.reader-target-highlight,.table-card.reader-target-highlight,.figure-card.reader-target-highlight{border-color:rgba(103,232,249,.42)!important;box-shadow:0 22px 70px rgba(0,0,0,.26),0 0 0 1px rgba(103,232,249,.32),0 0 34px rgba(103,232,249,.12)!important}@keyframes target-flash{0%,65%{outline:1px solid rgba(103,232,249,.62);outline-offset:6px}100%{outline:1px solid transparent;outline-offset:6px}}
    article{box-sizing:border-box;width:min(1120px,calc(100% - 48px));margin:0 auto;padding:38px 24px 72px}
    header{border-bottom:1px solid #27272a;margin-bottom:30px;padding-bottom:24px}
    .label{color:#67e8f9;font:700 11px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase}
    h1{margin:10px 0 14px;color:#fff;font:700 34px/1.14 ui-sans-serif,system-ui,sans-serif}
    h2{margin:34px 0 12px;color:#fff;font:700 23px/1.25 ui-sans-serif,system-ui,sans-serif}
    p{margin:0 0 18px;color:#e4e4e7}
    a{color:#67e8f9;text-decoration:underline;text-decoration-thickness:.08em;text-underline-offset:.18em}
    mark{border-radius:4px;background:rgba(103,232,249,.14);color:#e0f2fe;padding:0 .18em}
    .meta{color:#a1a1aa;font:13px/1.55 ui-sans-serif,system-ui,sans-serif}
    .abstract{border-left:3px solid #67e8f9;margin:24px 0 30px;padding-left:18px}
    aside{border:1px solid #27272a;background:#18181b;margin:22px 0;padding:14px 16px;border-radius:8px}
    aside strong{display:block;color:#f4f4f5;font:700 14px/1.45 ui-sans-serif,system-ui,sans-serif}
    img{display:block;max-width:100%;height:auto;margin:0 auto}
    .figure-card{overflow:hidden;padding:0;background:linear-gradient(180deg,rgba(24,28,34,.96),rgba(15,17,22,.98));border-radius:12px;box-shadow:0 22px 70px rgba(0,0,0,.26)}
    .figure-card>.label{display:inline-flex;margin:14px 16px 10px;border:1px solid rgba(103,232,249,.22);border-radius:999px;background:rgba(103,232,249,.08);padding:5px 9px}
    .figure-open{display:block;color:inherit!important;text-decoration:none!important}.figure-image-shell{position:relative;display:block;margin:0 14px 12px;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.1),rgba(255,255,255,.025) 46%,rgba(0,0,0,.2));box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
    .figure-image-shell img{width:100%;max-height:min(72vh,780px);object-fit:contain;background:#fff;padding:8px;box-sizing:border-box;transition:transform .25s ease}.figure-open:hover img{transform:scale(1.01)}
    .figure-zoom{position:absolute;right:12px;bottom:12px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(9,9,11,.82);backdrop-filter:blur(8px);color:#f4f4f5;font:700 10px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;padding:8px 10px;opacity:.92}
    .figure-caption{padding:0 16px 16px;color:#d4d4d8;font:14px/1.62 ui-sans-serif,system-ui,sans-serif}.figure-caption p{margin-bottom:10px;color:inherit}.figure-missing{margin:0 16px 14px;border:1px dashed rgba(161,161,170,.45);border-radius:10px;background:rgba(255,255,255,.035);padding:18px;color:#a1a1aa;font:13px/1.5 ui-sans-serif,system-ui,sans-serif;text-align:center}
    .metadata-card{display:grid;gap:16px;background:rgba(20,22,26,.72)}.metadata-card section{border-top:1px solid #27272a;padding-top:12px}.metadata-card section:first-child{border-top:0;padding-top:0}
    .resource-card,.boxed-text,.chem-card,.flowchart-card{background:linear-gradient(180deg,rgba(24,24,27,.96),rgba(14,14,16,.98))}.resource-link{display:inline-flex;margin-top:10px;border:1px solid rgba(103,232,249,.28);border-radius:999px;background:rgba(103,232,249,.08);padding:7px 11px;color:#a5f3fc!important;font:700 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.12em;text-decoration:none!important;text-transform:uppercase}.code-block{overflow:auto;border:1px solid #27272a;border-radius:8px;background:#0d1117;padding:14px 16px;color:#d1d5db;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre}.code-block:before{content:attr(data-language);display:block;margin-bottom:8px;color:#67e8f9;font:700 10px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}.flowchart-steps{display:grid;justify-items:center;gap:8px;margin:12px 0 16px}.flow-node{display:inline-flex;align-items:center;justify-content:center;min-width:150px;max-width:100%;border:1px solid rgba(103,232,249,.3);border-radius:8px;background:rgba(103,232,249,.1);padding:10px 14px;color:#f8fafc;font:700 13px/1.25 ui-sans-serif,system-ui,sans-serif;text-align:center}.flow-decision{border-radius:999px;background:rgba(250,204,21,.12);border-color:rgba(250,204,21,.38)}.flow-arrow{color:#67e8f9;font:700 18px/1 ui-sans-serif,system-ui,sans-serif}
    ul{margin:0 0 18px 22px;color:#e4e4e7}li{margin:0 0 8px}
    .table-wrap{margin-top:12px;overflow:auto}.table-wrap ul{margin:0;padding-left:18px}.table-wrap li{margin:0 0 6px}.table-wrap li:last-child{margin-bottom:0}
    table{width:100%;border-collapse:collapse;font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
    th,td{border:1px solid #3f3f46;padding:8px 10px;text-align:left;vertical-align:top}th{background:#27272a;color:#f4f4f5}
    .refs{padding-left:22px;color:#d4d4d8;font-size:14px;line-height:1.55}
    em{font-style:italic;color:#f8fafc}strong{font-weight:750;color:#fff}sub,sup{font-size:.72em;line-height:0}.xref,.inline-media{border-radius:4px;background:rgba(103,232,249,.12);padding:0 .2em;color:#a5f3fc;text-decoration:none}.inline-media{font:700 .78em/1.4 ui-sans-serif,system-ui,sans-serif}.small-caps{font-variant:small-caps}.formula{max-width:100%;vertical-align:middle}.formula-block{margin:18px 0;border:1px solid #27272a;border-radius:8px;background:#111113;padding:14px 16px;overflow-x:auto;overflow-y:visible;scrollbar-width:none;text-align:center}.formula-block::-webkit-scrollbar{width:0;height:0}.mathml-render{display:inline-flex;max-width:100%;overflow:visible;vertical-align:middle}.formula-block .mathml-render{display:inline-block;width:max-content;max-width:none;min-width:min-content}.mathml-render math{font-size:1.06em}.mathml-fallback{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#fef3c7}.katex{font-size:1.03em}.formula-block .katex-display{margin:0 auto}
    ${readerSelectionStyle}
  </style></head><body>${readerSelectionToolbarHtml}<article data-reader-content="true"><header><div class="label">${escapeHtml(label)}</div><h1>${titleHtml}</h1><div class="meta">${escapeHtml(authors.join(', ') || journal || 'Unknown authors')}${year ? ` &middot; ${escapeHtml(year)}` : ''}${pmc ? ` &middot; ${escapeHtml(pmc)}` : ''}${doi ? ` &middot; DOI ${escapeHtml(doi)}` : ''}</div></header>${abstractHtml ? `<section class="abstract"><div class="label">Abstract</div>${abstractHtml}</section>` : ''}${frontMatterHtml}${sectionHtml || `<p>${escapeHtml(xmlToPlainText(body).slice(0, 4000))}</p>`}${backHtml}</article><script>(()=>{const concreteIds=new Set();document.querySelectorAll('[id]').forEach((node)=>{if(!/^(H[1-6]|UL|OL)$/.test(node.tagName))concreteIds.add(node.id)});document.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id],ul[id],ol[id]').forEach((node)=>{if(concreteIds.has(node.id))node.removeAttribute('id')});})();${readerTargetHighlightScript}${readerSelectionScript}</script></body></html>`);
};

export const readerMessageHtml = (message: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
    :root{color-scheme:dark;background:#09090b;color:#f4f4f5}
    body{margin:0;background:#09090b;color:#f4f4f5;font:14px/1.7 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{min-height:100vh;box-sizing:border-box;display:grid;place-items:center;padding:32px}
    section{max-width:680px;border:1px solid #27272a;border-radius:12px;background:#18181b;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.35)}
    p{margin:0;color:#d4d4d8}
    strong{display:block;margin-bottom:10px;color:#f4f4f5;font-size:12px;letter-spacing:.18em;text-transform:uppercase}
  </style></head><body><main><section><strong>Reader proxy</strong><p>${escapeHtml(message)}</p></section></main></body></html>`;

export const readerHtmlDocument = (body: string, target: URL) => {
  const baseHref = escapeHtml(new URL('.', target).toString());
  const targetHref = JSON.stringify(target.toString());
  const readerInternalNavigationScript = `(()=>{const readerTarget=${targetHref};const normalizePath=(path)=>path.replace(/\\/+$/,'');const scrollToHash=(hash)=>{if(!hash)return false;const id=decodeURIComponent(hash.replace(/^#/,''));const node=document.getElementById(id)||document.querySelector('[name="'+CSS.escape(id)+'"]');if(!node)return false;node.scrollIntoView({block:'start',behavior:'smooth'});try{history.replaceState(null,'','#'+encodeURIComponent(id))}catch{}return true};document.addEventListener('click',(event)=>{const link=event.target instanceof Element?event.target.closest('a[href]'):null;if(!link)return;const raw=link.getAttribute('href')||'';let url;try{url=new URL(raw,readerTarget)}catch{return}const targetUrl=new URL(readerTarget);const isFragmentOnly=raw.trim().startsWith('#');const isSameDocument=url.origin===targetUrl.origin&&normalizePath(url.pathname)===normalizePath(targetUrl.pathname)&&url.search===targetUrl.search;if((isFragmentOnly||isSameDocument)&&url.hash){event.preventDefault();scrollToHash(url.hash)}});})();`;
  const injectedHead = `<base href="${baseHref}"><style>
    ${readerSelectionStyle}
    html{scroll-behavior:smooth}
    body{background:Canvas;color:CanvasText}
    img,svg,video,canvas{max-width:100%;height:auto}
    [data-reader-content="true"]{max-width:980px;margin:0 auto}
  </style>`;
  let html = body;

  if (/<head[\s>]/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${injectedHead}`);
  } else {
    html = html.replace(/<html([^>]*)>/i, `<html$1><head>${injectedHead}</head>`);
  }

  if (/<body[\s>]/i.test(html)) {
    html = html.replace(/<body([^>]*)>/i, `<body$1 data-reader-content="true">${readerSelectionToolbarHtml}`);
    html = html.replace(/<\/body\s*>/i, `<script>${readerInternalNavigationScript}${readerSelectionScript}</script></body>`);
  } else {
    html += `${readerSelectionToolbarHtml}<script>${readerInternalNavigationScript}${readerSelectionScript}</script>`;
  }

  return html;
};

export const readerTextHtml = async (body: string, contentType: string, target: URL) => {
  const parsedArticle = parseArticleXml(body);
  const useBioCRenderer = parsedArticle.kind === 'bioc' || (parsedArticle.kind === 'unknown' && isBioCReaderSource(target, body));
  const pmcForImages = parsedArticle.pmcId || (useBioCRenderer ? getBioCPmcId(body) : getJatsPmcId(body));
  const imageMap = pmcForImages ? await fetchPmcImageMap(pmcForImages) : {};
  const renderedArticle = (useBioCRenderer ? renderBioCArticleHtml(body, contentType, imageMap) : null)
    || renderJatsArticleHtml(body, target, imageMap);
  return renderedArticle || `<!doctype html><html><head><meta charset="utf-8"><style>
    :root{color-scheme:dark;background:#09090b;color:#f4f4f5}
    body{margin:0;background:#09090b;color:#f4f4f5;font:15px/1.65 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace}
    header{position:sticky;top:0;background:#18181b;border-bottom:1px solid #27272a;padding:10px 18px;color:#a1a1aa;font:11px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase}
    pre{box-sizing:border-box;width:min(1180px,calc(100% - 48px));min-height:100vh;margin:0 auto;padding:24px;white-space:pre-wrap;word-break:break-word;color:#f4f4f5;background:#09090b}
    ${readerSelectionStyle}
  </style></head><body>${readerSelectionToolbarHtml}<header>${escapeHtml(contentType)}</header><pre data-reader-content="true">${escapeHtml(body)}</pre><script>
    ${readerSelectionScript}
  </script></body></html>`;
};
