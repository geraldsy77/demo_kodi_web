import {
  createBrowserRouter,
  NavLink,
  Outlet,
  RouterProvider,
  useRouteError,
  type RouteObject,
} from 'react-router-dom';

import { ErrorState, RouteLoading } from './components/RouteState';
import { HomePage } from './pages/ShellPages';
import { MovieBrowsePage } from './pages/MovieBrowsePage';
import { MovieDetailPage } from './pages/MovieDetailPage';
import { TvShowBrowsePage, TvShowDetailPage } from './pages/TvShowPages';
import { SearchPage } from './pages/SearchPage';

const navigation = [
  { to: '/', label: 'Home', end: true },
  { to: '/movies', label: 'Movies', end: false },
  { to: '/tvshows', label: 'TV Shows', end: false },
  { to: '/search', label: 'Search', end: false },
] as const;

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/" aria-label="KODI Web home">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>
            <strong>KODI</strong>
            <small>Web library</small>
          </span>
        </NavLink>
        <nav className="primary-navigation" aria-label="Primary navigation">
          {navigation.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <span className="nav-indicator" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="library-note">Your library, on your network.</p>
      </aside>
      <main className="main-content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : undefined;

  return <ErrorState message={message} />;
}

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <RouteLoading />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'movies',
        element: <MovieBrowsePage />,
      },
      {
        path: 'movies/:id',
        element: <MovieDetailPage />,
      },
      {
        path: 'tvshows',
        element: <TvShowBrowsePage />,
      },
      {
        path: 'tvshows/:id',
        element: <TvShowDetailPage />,
      },
      {
        path: 'search',
        element: <SearchPage />,
      },
      {
        path: '*',
        element: (
          <ErrorState
            title="Page not found"
            message="This page is not part of your library."
          />
        ),
      },
    ],
  },
];

const router = createBrowserRouter(appRoutes);

export function App() {
  return <RouterProvider router={router} />;
}
