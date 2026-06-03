import { XMLParser, XMLValidator } from 'fast-xml-parser';

const articleXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
});

export interface ParsedArticleXml {
  kind: 'bioc' | 'jats' | 'unknown';
  document: any;
  pmcId: string;
}

const toArray = <T,>(value: T | T[] | undefined | null): T[] => (
  Array.isArray(value) ? value : value ? [value] : []
);

const normalizePmcId = (value: unknown) => {
  const text = String(value || '').replace(/\s+/g, '').trim();
  if (/^PMC\d+$/i.test(text)) return text.toUpperCase();
  if (/^\d+$/.test(text)) return `PMC${text}`;
  return '';
};

const getNodeText = (value: any): string => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(getNodeText).join(' ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('@_'))
      .map(([, entry]) => getNodeText(entry))
      .join(' ');
  }
  return '';
};

export const parseArticleXml = (body: string): ParsedArticleXml => {
  try {
    const validation = XMLValidator.validate(body);
    if (validation !== true) return { kind: 'unknown', document: null, pmcId: '' };
    const document = articleXmlParser.parse(body);
    const hasBioCPassages = Boolean(document?.collection?.document?.passage || document?.collection?.passage);
    const article = document?.article;
    const articleMeta = article?.front?.['article-meta'];
    const articleIds = toArray(articleMeta?.['article-id']);
    const parsedPmc = articleIds.find((entry: any) => entry?.['@_pub-id-type'] === 'pmcid');
    const pmcId = normalizePmcId(getNodeText(parsedPmc));
    if (hasBioCPassages) return { kind: 'bioc', document, pmcId };
    if (article) return { kind: 'jats', document, pmcId };
    return { kind: 'unknown', document, pmcId };
  } catch {
    return { kind: 'unknown', document: null, pmcId: '' };
  }
};
