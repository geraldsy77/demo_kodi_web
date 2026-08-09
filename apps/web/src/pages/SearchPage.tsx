import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { MovieGridLoading } from '../components/MovieGrid';
import { searchLibrary, type SearchResponse } from '../services/api';

type SearchStatus = { state: 'idle' } | { state: 'loading' } |
  { state: 'error' } | { state: 'ready'; response: SearchResponse };

function positivePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function SearchPage() {
  const [parameters, setParameters] = useSearchParams();
  const query = (parameters.get('q') ?? '').trim();
  const page = positivePage(parameters.get('page'));
  const [input, setInput] = useState(query);
  const [validation, setValidation] = useState<string | null>(null);
  const [status, setStatus] = useState<SearchStatus>(query ? { state: 'loading' } : { state: 'idle' });
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => setInput(query), [query]);
  useEffect(() => {
    if (!query) { setStatus({ state: 'idle' }); return; }
    const controller = new AbortController();
    setStatus({ state: 'loading' });
    void searchLibrary(query, page, controller.signal)
      .then((response) => setStatus({ state: 'ready', response }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus({ state: 'error' });
      });
    return () => controller.abort();
  }, [query, page, requestKey]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = input.trim();
    if (!normalized) { setValidation('Enter a title to search.'); return; }
    if (normalized.length > 100) { setValidation('Search must be 100 characters or fewer.'); return; }
    setValidation(null);
    setParameters({ q: normalized });
  };
  const move = (next: number) => setParameters(next === 1 ? { q: query } : { q: query, page: String(next) });

  return <div className="search-page"><header className="page-heading"><p className="eyebrow">Discover</p><h1>Search</h1><p className="page-intro">Find movies and TV shows across your KODI library.</p></header>
    <form className="search-form" role="search" onSubmit={submit}><label htmlFor="library-search">Title</label><div><input id="library-search" value={input} onChange={(event) => setInput(event.target.value)} maxLength={101} placeholder="Search your library" aria-describedby={validation ? 'search-validation' : undefined} /><button type="submit">Search</button></div>{validation && <p id="search-validation" role="alert">{validation}</p>}</form>
    {status.state === 'idle' && <section className="search-guidance"><p>Search by a full or partial title. Results will identify movies and TV shows.</p></section>}
    {status.state === 'loading' && <MovieGridLoading label="Searching library" />}
    {status.state === 'error' && <section className="dashboard-message" role="alert"><p className="eyebrow">Search interrupted</p><h2>Results couldn’t be loaded.</h2><p>Check the API connection, then try again.</p><button className="button-link" type="button" onClick={() => setRequestKey((key) => key + 1)}>Try again</button></section>}
    {status.state === 'ready' && status.response.items.length === 0 && <section className="dashboard-message empty-state" role="status"><p className="eyebrow">No matches</p><h2>Nothing matched “{query}”.</h2><p>Try a shorter title or check the spelling.</p></section>}
    {status.state === 'ready' && status.response.items.length > 0 && <><div className="search-result-heading"><p>{status.response.pagination.totalItems.toLocaleString()} results for <strong>“{query}”</strong></p></div><section className="search-results" aria-label="Search results">{status.response.items.map((result) => <Link className="search-result" key={`${result.entityType}-${result.id}`} to={`/${result.entityType === 'movie' ? 'movies' : 'tvshows'}/${result.id}`}><span className={`result-mark ${result.entityType}`}>{result.title.slice(0, 1).toUpperCase()}</span><span><strong>{result.title}</strong><small>{result.entityType === 'movie' ? 'Movie' : 'TV Show'}</small></span><span aria-hidden="true">→</span></Link>)}</section><nav className="pagination" aria-label="Search result pages"><button type="button" disabled={page <= 1} onClick={() => move(page - 1)}>Previous</button><span>Page {page} of {status.response.pagination.totalPages}</span><button type="button" disabled={page >= status.response.pagination.totalPages} onClick={() => move(page + 1)}>Next</button></nav></>}
  </div>;
}
