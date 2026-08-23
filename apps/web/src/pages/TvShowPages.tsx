import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { MovieGridLoading } from '../components/MovieGrid';
import { PosterArtwork } from '../components/PosterArtwork';
import { TvShowGrid } from '../components/TvShowGrid';
import {
  ApiRequestError,
  fetchTvShow,
  fetchTvShows,
  type TvShowDetail,
  type TvShowListResponse,
} from '../services/api';

type ListStatus = { state: 'loading' } | { state: 'error' } |
  { state: 'ready'; response: TvShowListResponse };
type DetailStatus = { state: 'loading' } | { state: 'notFound' } |
  { state: 'error' } | { state: 'ready'; show: TvShowDetail };

function positiveInteger(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function publicId(value: string | undefined): string | null {
  return value && /^[A-Za-z1-9]{11,}$/.test(value) ? value : null;
}

export function TvShowBrowsePage() {
  const [parameters, setParameters] = useSearchParams();
  const page = positiveInteger(parameters.get('page')) ?? 1;
  const [status, setStatus] = useState<ListStatus>({ state: 'loading' });
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus({ state: 'loading' });
    void fetchTvShows(page, controller.signal)
      .then((response) => setStatus({ state: 'ready', response }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus({ state: 'error' });
      });
    return () => controller.abort();
  }, [page, requestKey]);

  const move = (next: number) => {
    setParameters(next === 1 ? {} : { page: String(next) });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="browse-page">
      <header className="browse-heading"><div><p className="eyebrow">Browse</p><h1>TV Shows</h1></div>
        {status.state === 'ready' && status.response.pagination.totalItems > 0 && <p>{status.response.pagination.totalItems.toLocaleString()} shows</p>}
      </header>
      {status.state === 'loading' && <MovieGridLoading label="Loading TV shows" />}
      {status.state === 'error' && <section className="dashboard-message" role="alert"><p className="eyebrow">Connection interrupted</p><h2>TV shows couldn’t be loaded.</h2><p>Check the API connection, then try again.</p><button className="button-link" type="button" onClick={() => setRequestKey((key) => key + 1)}>Try again</button></section>}
      {status.state === 'ready' && status.response.items.length === 0 && <section className="dashboard-message empty-state" role="status"><p className="eyebrow">No shows found</p><h2>Your TV shelf is empty.</h2><p>Add TV shows in KODI, then return here.</p><Link className="button-link" to="/">Return home</Link></section>}
      {status.state === 'ready' && status.response.items.length > 0 && <><TvShowGrid shows={status.response.items} /><nav className="pagination" aria-label="TV-show pages"><button type="button" disabled={page <= 1} onClick={() => move(page - 1)}>Previous</button><span>Page {page} of {status.response.pagination.totalPages}</span><button type="button" disabled={page >= status.response.pagination.totalPages} onClick={() => move(page + 1)}>Next</button></nav></>}
    </div>
  );
}

export function TvShowDetailPage() {
  const showId = publicId(useParams().id);
  const [status, setStatus] = useState<DetailStatus>(showId ? { state: 'loading' } : { state: 'notFound' });
  const [requestKey, setRequestKey] = useState(0);
  useEffect(() => {
    if (!showId) { setStatus({ state: 'notFound' }); return; }
    const controller = new AbortController();
    setStatus({ state: 'loading' });
    void fetchTvShow(showId, controller.signal).then((show) => setStatus({ state: 'ready', show })).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus(error instanceof ApiRequestError && error.status === 404 ? { state: 'notFound' } : { state: 'error' });
    });
    return () => controller.abort();
  }, [showId, requestKey]);

  if (status.state === 'loading') return <div className="movie-detail movie-detail-loading" aria-label="Loading TV-show details" aria-busy="true"><div className="detail-poster detail-skeleton" /><div className="detail-copy detail-skeleton" /></div>;
  if (status.state === 'notFound') return <section className="dashboard-message empty-state" role="alert"><p className="eyebrow">TV show not found</p><h1>This show isn’t available.</h1><p>It may have been removed from KODI or the link may be incorrect.</p><Link className="button-link" to="/tvshows">Back to TV shows</Link></section>;
  if (status.state === 'error') return <section className="dashboard-message" role="alert"><p className="eyebrow">Connection interrupted</p><h1>TV-show details couldn’t be loaded.</h1><p>Check the API connection, then try again.</p><button className="button-link" type="button" onClick={() => setRequestKey((key) => key + 1)}>Try again</button></section>;

  const { show } = status;
  const watched = show.watchedEpisodes ?? 0;
  const percent = show.totalEpisodes && show.totalEpisodes > 0 ? Math.min(100, watched / show.totalEpisodes * 100) : null;
  return <article className="movie-detail"><div className="detail-poster tv-poster" aria-hidden="true"><PosterArtwork artworkUrl={show.artworkUrl} title={show.title} /></div><div className="detail-copy"><Link className="back-link" to="/tvshows">← Back to TV shows</Link><p className="eyebrow">TV Show</p><h1>{show.title}</h1><div className="detail-facts" aria-label="TV-show facts">{show.premiered && <span>{show.premiered.slice(0, 4)}</span>}{show.rating !== null && <span>★ {show.rating.toFixed(1)}</span>}{show.votes !== null && <span>{show.votes.toLocaleString()} votes</span>}{show.totalSeasons !== null && <span>{show.totalSeasons} seasons</span>}</div><p className="detail-plot">{show.plot || 'No plot summary is available.'}</p>{percent !== null && <section className="resume-panel" aria-label="Episode progress"><div><strong>Episode progress</strong><span>{watched} of {show.totalEpisodes} watched</span></div><progress max="100" value={percent}>{Math.round(percent)}%</progress></section>}<dl className="detail-metadata">{show.durationSeconds !== null && <><dt>Episode runtime</dt><dd>{Math.round(show.durationSeconds / 60)} min</dd></>}{show.userRating !== null && <><dt>Your rating</dt><dd>{show.userRating}/10</dd></>}{show.dateAdded && <><dt>Added</dt><dd>{show.dateAdded.slice(0, 10)}</dd></>}{show.lastPlayed && <><dt>Last played</dt><dd>{show.lastPlayed.slice(0, 10)}</dd></>}</dl></div></article>;
}
