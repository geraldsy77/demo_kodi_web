// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from './App';
import { ErrorState, RouteLoading } from './components/RouteState';

afterEach(cleanup);

function apiResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return { ok, status, json: async () => body } as Response;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: string) => {
      if (input.startsWith('/api/movies?')) {
        return Promise.resolve(apiResponse(moviePage()));
      }
      if (/^\/api\/movies\/\d+$/.test(input)) {
        return Promise.resolve(apiResponse(movieDetail()));
      }
      if (input.startsWith('/api/tvshows?')) {
        return Promise.resolve(apiResponse(tvShowPage()));
      }
      if (/^\/api\/tvshows\/\d+$/.test(input)) {
        return Promise.resolve(apiResponse(tvShowDetail()));
      }
      if (input.startsWith('/api/search?')) {
        return Promise.resolve(apiResponse(searchPage()));
      }
      return Promise.resolve(apiResponse({ movieCount: 38, tvShowCount: 26 }));
    }),
  );
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

function moviePage(items = [
  {
    id: 7,
    title: 'Example Movie',
    premiered: '2025-01-01',
    rating: 7.5,
    playCount: 1,
    artworkUrl: 'https://images.example.test/movie-poster.jpg',
  },
]) {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 24,
      totalItems: 25,
      totalPages: 2,
    },
  };
}

function movieDetail() {
  return {
    id: 7,
    title: 'Example Movie',
    artworkUrl: 'https://images.example.test/movie-poster.jpg',
    plot: 'A thoughtful example plot.',
    premiered: '2025-01-01',
    userRating: 9,
    rating: 7.5,
    votes: 1200,
    playCount: 1,
    lastPlayed: '2026-01-01 12:00:00',
    dateAdded: '2025-01-02 12:00:00',
    resume: { positionSeconds: 1800, totalSeconds: 7200 },
  };
}

function tvShowPage() {
  return {
    items: [{ id: 12, title: 'Example Show', premiered: '2020-01-01', rating: 8.2, totalEpisodes: 20, watchedEpisodes: 5, totalSeasons: 2, artworkUrl: 'https://images.example.test/show-poster.jpg' }],
    pagination: { page: 1, pageSize: 24, totalItems: 25, totalPages: 2 },
  };
}

function tvShowDetail() {
  return {
    ...tvShowPage().items[0],
    plot: 'A thoughtful show plot.',
    userRating: 9,
    durationSeconds: 2700,
    votes: 2500,
    lastPlayed: '2026-01-01 12:00:00',
    dateAdded: '2020-01-02 12:00:00',
  };
}

function searchPage() {
  return {
    items: [
      { id: 7, title: 'Example Movie', entityType: 'movie' },
      { id: 12, title: 'Example Show', entityType: 'tvshow' },
    ],
    pagination: { page: 1, pageSize: 24, totalItems: 26, totalPages: 2 },
  };
}

describe('application shell', () => {
  it.each([
    ['/', 'Your library.'],
    ['/movies', 'Movies'],
    ['/tvshows', 'TV Shows'],
    ['/search', 'Search'],
  ])('renders route %s with the expected heading', (path, heading) => {
    renderRoute(path);

    expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
  });

  it('contains the required accessible navigation and active state', () => {
    renderRoute('/movies');

    const navigation = screen.getByRole('navigation', {
      name: 'Primary navigation',
    });
    expect(navigation.querySelectorAll('a')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Movies' }).getAttribute('aria-current'))
      .toBe('page');
    expect(screen.getByRole('link', { name: 'TV Shows' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Search' })).toBeTruthy();
  });

  it('renders a friendly not-found state inside the shell', () => {
    renderRoute('/not-a-route');

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});

describe('home dashboard', () => {
  it('shows loading then populated library totals and browse links', async () => {
    renderRoute('/');

    expect(screen.getByLabelText('Loading library summary')).toBeTruthy();
    expect(await screen.findByText('38')).toBeTruthy();
    expect(screen.getByText('26')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Browse movies/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Browse shows/ })).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/library/summary', expect.objectContaining({
      headers: { Accept: 'application/json' },
    }));
  });

  it('shows guidance when the library is empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      apiResponse({ movieCount: 0, tvShowCount: 0 }),
    );
    renderRoute('/');

    expect(await screen.findByText(/Your library is empty/)).toBeTruthy();
  });

  it('shows a recoverable error and retries the request', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(apiResponse({ movieCount: 4, tvShowCount: 2 }));
    renderRoute('/');

    const retry = await screen.findByRole('button', { name: 'Try again' });
    fireEvent.click(retry);

    expect(await screen.findByText('4')).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('rejects an invalid successful API response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      apiResponse({ movieCount: -1, tvShowCount: 'unknown' }),
    );
    renderRoute('/');

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('movie browse page', () => {
  it('shows a loading grid then populated movie cards', async () => {
    renderRoute('/movies');

    expect(screen.getByLabelText('Loading movies')).toBeTruthy();
    const movieLink = await screen.findByRole('link', {
      name: 'View Example Movie',
    });
    expect(movieLink.getAttribute('href')).toBe('/movies/7');
    expect(screen.getByText('2025')).toBeTruthy();
    expect(screen.getByText('★ 7.5')).toBeTruthy();
    expect(screen.getByText('Watched')).toBeTruthy();
  });

  it('opens the movie detail route from a card', async () => {
    renderRoute('/movies');

    fireEvent.click(await screen.findByRole('link', {
      name: 'View Example Movie',
    }));

    expect(await screen.findByRole('heading', { name: 'Example Movie' }))
      .toBeTruthy();
  });

  it('stores pagination in the URL and loads the next page', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(apiResponse(moviePage()))
      .mockResolvedValueOnce(apiResponse({
        ...moviePage(),
        items: [{
          id: 8,
          title: 'Second Page Movie',
          premiered: null,
          rating: null,
          playCount: null,
          artworkUrl: null,
        }],
        pagination: { ...moviePage().pagination, page: 2 },
      }));
    renderRoute('/movies');

    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('link', { name: 'View Second Page Movie' }))
      .toBeTruthy();
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/movies?page=2&pageSize=24',
      expect.any(Object),
    );
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  });

  it('shows an empty-library state', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(apiResponse({
      items: [],
      pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 },
    }));
    renderRoute('/movies');

    expect(await screen.findByText('Your movie shelf is empty.')).toBeTruthy();
  });

  it('shows an error state and retries', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(apiResponse(moviePage()));
    renderRoute('/movies');

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'View Example Movie' }))
      .toBeTruthy();
  });
});

describe('movie detail page', () => {
  it('shows loading then verified movie metadata and resume progress', async () => {
    renderRoute('/movies/7');

    expect(screen.getByLabelText('Loading movie details')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Example Movie' }))
      .toBeTruthy();
    expect(screen.getByText('A thoughtful example plot.')).toBeTruthy();
    expect(screen.getByText('★ 7.5')).toBeTruthy();
    expect(screen.getByText('1,200 votes')).toBeTruthy();
    expect(screen.getByText('Watched')).toBeTruthy();
    const poster = document.querySelector<HTMLImageElement>('.poster-image');
    expect(poster?.src).toBe('https://images.example.test/movie-poster.jpg');
    fireEvent.error(poster as HTMLImageElement);
    expect(screen.getByText('E')).toBeTruthy();
    expect(screen.getByText('30m of 2h 0m')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('25');
    expect(fetch).toHaveBeenCalledWith('/api/movies/7', expect.any(Object));
  });

  it('shows the API not-found state', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(apiResponse({
      error: { code: 'MOVIE_NOT_FOUND', message: 'Movie not found.' },
    }, false, 404));
    renderRoute('/movies/999');

    expect(await screen.findByText('This movie isn’t available.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to movies' })).toBeTruthy();
  });

  it('rejects an invalid route ID without an API request', async () => {
    renderRoute('/movies/not-an-id');

    expect(await screen.findByText('This movie isn’t available.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows an error state and retries movie detail', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(apiResponse(movieDetail()));
    renderRoute('/movies/7');

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Example Movie' }))
      .toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid successful detail response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(apiResponse({ id: 7, title: null }));
    renderRoute('/movies/7');

    expect(await screen.findByText('Movie details couldn’t be loaded.'))
      .toBeTruthy();
  });
});

describe('TV-show browse page', () => {
  it('loads responsive show cards and opens the detail route', async () => {
    renderRoute('/tvshows');
    expect(screen.getByLabelText('Loading TV shows')).toBeTruthy();
    const show = await screen.findByRole('link', { name: 'View Example Show' });
    expect(show.getAttribute('href')).toBe('/tvshows/12');
    expect(screen.getByText('2 seasons')).toBeTruthy();
    expect(screen.getByText('5 / 20 episodes')).toBeTruthy();
    fireEvent.click(show);
    expect(await screen.findByRole('heading', { name: 'Example Show' })).toBeTruthy();
  });

  it('paginates TV shows through the URL', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(apiResponse(tvShowPage()))
      .mockResolvedValueOnce(apiResponse({
        ...tvShowPage(),
        items: [{ ...tvShowPage().items[0], id: 13, title: 'Next Show' }],
        pagination: { ...tvShowPage().pagination, page: 2 },
      }));
    renderRoute('/tvshows');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('link', { name: 'View Next Show' })).toBeTruthy();
    expect(fetch).toHaveBeenLastCalledWith('/api/tvshows?page=2&pageSize=24', expect.any(Object));
  });

  it('handles empty and retryable TV-show list states', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(apiResponse({
      items: [], pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 },
    }));
    renderRoute('/tvshows');
    expect(await screen.findByText('Your TV shelf is empty.')).toBeTruthy();
    cleanup();

    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(apiResponse(tvShowPage()));
    renderRoute('/tvshows');
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'View Example Show' })).toBeTruthy();
  });
});

describe('TV-show detail page', () => {
  it('renders verified detail metadata and episode progress', async () => {
    renderRoute('/tvshows/12');
    expect(screen.getByLabelText('Loading TV-show details')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Example Show' })).toBeTruthy();
    expect(screen.getByText('A thoughtful show plot.')).toBeTruthy();
    expect(screen.getByText('5 of 20 watched')).toBeTruthy();
    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText('2,500 votes')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('25');
  });

  it('handles not-found and invalid show IDs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(apiResponse({ error: { message: 'TV show not found.' } }, false, 404));
    renderRoute('/tvshows/999');
    expect(await screen.findByText('This show isn’t available.')).toBeTruthy();
    cleanup();
    vi.mocked(fetch).mockClear();
    renderRoute('/tvshows/bad-id');
    expect(await screen.findByText('This show isn’t available.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retries a failed TV-show detail request', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(apiResponse(tvShowDetail()));
    renderRoute('/tvshows/12');
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Example Show' })).toBeTruthy();
  });
});

describe('search page', () => {
  it('starts with guidance and validates an empty query', () => {
    renderRoute('/search');
    expect(screen.getByText(/Search by a full or partial title/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter a title');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('searches, distinguishes entity types, and links to details', async () => {
    renderRoute('/search');
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: '  Example  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByLabelText('Searching library')).toBeTruthy();
    const movie = await screen.findByRole('link', { name: /Example Movie/ });
    const show = screen.getByRole('link', { name: /Example Show/ });
    expect(movie.getAttribute('href')).toBe('/movies/7');
    expect(show.getAttribute('href')).toBe('/tvshows/12');
    expect(screen.getByText('Movie')).toBeTruthy();
    expect(screen.getByText('TV Show')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      '/api/search?q=Example&page=1&pageSize=24',
      expect.any(Object),
    );
  });

  it('paginates while preserving the search query', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(apiResponse(searchPage()))
      .mockResolvedValueOnce(apiResponse({
        ...searchPage(),
        items: [{ id: 8, title: 'Another Example', entityType: 'movie' }],
        pagination: { ...searchPage().pagination, page: 2 },
      }));
    renderRoute('/search?q=Example');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('link', { name: /Another Example/ })).toBeTruthy();
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/search?q=Example&page=2&pageSize=24', expect.any(Object),
    );
  });

  it('handles no results and retryable errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(apiResponse({
      items: [], pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 },
    }));
    renderRoute('/search?q=Missing');
    expect(await screen.findByText('Nothing matched “Missing”.')).toBeTruthy();
    cleanup();

    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(apiResponse(searchPage()));
    renderRoute('/search?q=Example');
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: /Example Movie/ })).toBeTruthy();
  });

  it('rejects an invalid successful search response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(apiResponse({ items: [{ entityType: 'episode' }] }));
    renderRoute('/search?q=Example');
    expect(await screen.findByText('Results couldn’t be loaded.')).toBeTruthy();
  });
});

describe('shared route states', () => {
  it('announces route loading', () => {
    render(<RouteLoading />);

    expect(screen.getByText('Loading your library…')).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('renders a recoverable error state', () => {
    render(
      <MemoryRouter>
        <ErrorState message="The service is unavailable." />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('The service is unavailable.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Return home' })).toBeTruthy();
  });
});
