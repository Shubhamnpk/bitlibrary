import type { IncomingMessage, ServerResponse } from 'node:http';

type ResearchProvider =
  | 'arxiv'
  | 'semanticscholar'
  | 'semanticscholar-paper'
  | 'pmc-search'
  | 'pmc-summary'
  | 'europepmc'
  | 'openalex'
  | 'openalex-work'
  | 'crossref'
  | 'crossref-work'
  | 'datacite'
  | 'datacite-doi'
  | 'zenodo-record'
  | 'unpaywall';

const copyParams = (source: URLSearchParams, target: URLSearchParams, keys: string[]) => {
  keys.forEach((key) => {
    const value = source.get(key);
    if (value) target.set(key, value);
  });
};

const providerTargets: Record<ResearchProvider, (params: URLSearchParams) => string | null> = {
  arxiv: (params) => {
    const upstream = new URL('https://export.arxiv.org/api/query');
    copyParams(params, upstream.searchParams, ['search_query', 'id_list', 'start', 'max_results', 'sortBy', 'sortOrder']);
    return upstream.toString();
  },
  semanticscholar: (params) => {
    const upstream = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
    copyParams(params, upstream.searchParams, ['query', 'limit', 'fields']);
    return upstream.toString();
  },
  'semanticscholar-paper': (params) => {
    const paperId = params.get('paperId');
    if (!paperId || !/^[\w.:/-]+$/.test(paperId)) return null;
    const upstream = new URL(`https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}`);
    copyParams(params, upstream.searchParams, ['fields']);
    return upstream.toString();
  },
  'pmc-search': (params) => {
    const upstream = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
    copyParams(params, upstream.searchParams, ['db', 'term', 'retmode', 'retmax', 'sort']);
    return upstream.toString();
  },
  'pmc-summary': (params) => {
    const upstream = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
    copyParams(params, upstream.searchParams, ['db', 'id', 'retmode']);
    return upstream.toString();
  },
  europepmc: (params) => {
    const upstream = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    copyParams(params, upstream.searchParams, ['query', 'format', 'pageSize', 'resultType', 'synonym']);
    return upstream.toString();
  },
  openalex: (params) => {
    const upstream = new URL('https://api.openalex.org/works');
    copyParams(params, upstream.searchParams, ['search', 'per_page', 'sort', 'mailto']);
    return upstream.toString();
  },
  'openalex-work': (params) => {
    const workId = params.get('workId');
    if (!workId || !/^[\w:/.-]+$/.test(workId)) return null;
    return `https://api.openalex.org/works/${encodeURIComponent(workId)}`;
  },
  crossref: (params) => {
    const upstream = new URL('https://api.crossref.org/works');
    copyParams(params, upstream.searchParams, ['query', 'rows', 'sort', 'order', 'filter', 'mailto']);
    return upstream.toString();
  },
  'crossref-work': (params) => {
    const doi = params.get('doi');
    if (!doi || !/^10\.\S+\/\S+/.test(doi)) return null;
    return `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  },
  datacite: (params) => {
    const upstream = new URL('https://api.datacite.org/dois');
    copyParams(params, upstream.searchParams, ['query', 'page[size]']);
    return upstream.toString();
  },
  'datacite-doi': (params) => {
    const doi = params.get('doi');
    if (!doi || !/^10\.\S+\/\S+/.test(doi)) return null;
    return `https://api.datacite.org/dois/${encodeURIComponent(doi)}`;
  },
  'zenodo-record': (params) => {
    const recordId = params.get('recordId');
    if (!recordId || !/^\d+$/.test(recordId)) return null;
    return `https://zenodo.org/api/records/${recordId}`;
  },
  unpaywall: (params) => {
    const doi = params.get('doi');
    const email = params.get('email');
    if (!doi || !email) return null;
    const upstream = new URL(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}`);
    upstream.searchParams.set('email', email);
    return upstream.toString();
  },
};

const sendText = (response: ServerResponse, statusCode: number, message: string) => {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.end(message);
};

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = new URL(request.url || '/', 'https://bitlibrary.local');
  const provider = requestUrl.searchParams.get('provider') as ResearchProvider | null;
  if (!provider || !(provider in providerTargets)) {
    sendText(response, 400, 'Unknown research provider.');
    return;
  }

  const targetUrl = providerTargets[provider](requestUrl.searchParams);
  if (!targetUrl) {
    sendText(response, 400, 'Missing research provider parameters.');
    return;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        accept: provider === 'arxiv' ? 'application/atom+xml,application/xml,text/xml,*/*' : 'application/json,*/*',
        'user-agent': 'BitLibrary/0.5.0 (academic research discovery; https://github.com/Shubhamnpk/bitlibrary)',
      },
    });
    const body = await upstream.arrayBuffer();

    response.statusCode = upstream.status;
    response.setHeader('content-type', upstream.headers.get('content-type') || (provider === 'arxiv' ? 'application/xml; charset=utf-8' : 'application/json; charset=utf-8'));
    response.setHeader('cache-control', upstream.ok ? 'public, max-age=1800, s-maxage=3600' : 'no-store');
    response.setHeader('access-control-allow-origin', '*');
    response.end(Buffer.from(body));
  } catch {
    sendText(response, 502, 'Research proxy failed.');
  }
}
