import { Link } from 'react-router-dom';

import type { TvShowListItem } from '../services/api';
import { PosterArtwork } from './PosterArtwork';

export function TvShowGrid({ shows }: { shows: TvShowListItem[] }) {
  return (
    <section className="movie-grid" aria-label="TV shows">
      {shows.map((show) => {
        const watched = show.totalEpisodes !== null && show.totalEpisodes > 0 &&
          show.watchedEpisodes === show.totalEpisodes;
        return (
          <Link className="movie-card" key={show.id} to={`/tvshows/${show.id}`} aria-label={`View ${show.title}`}>
            <span className="poster-placeholder tv-poster" aria-hidden="true">
              <PosterArtwork artworkUrl={show.artworkUrl} title={show.title} />
              {watched && <small className="watched-badge">Watched</small>}
            </span>
            <span className="movie-card-copy">
              <strong title={show.title}>{show.title}</strong>
              <span className="movie-metadata">
                {show.totalSeasons !== null && <span>{show.totalSeasons} seasons</span>}
                {show.rating !== null && <span>★ {show.rating.toFixed(1)}</span>}
              </span>
              {show.totalEpisodes !== null && (
                <span className="episode-progress">
                  {show.watchedEpisodes ?? 0} / {show.totalEpisodes} episodes
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
