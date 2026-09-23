import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import EventPage from './EventPage';
import HomePage from './HomePage';

const TvPage = lazy(() => import('./TvPage'));
const SandboxPhone = import.meta.env.DEV ? lazy(() => import('./sandbox/SandboxPhone')) : null;
const SandboxTv = import.meta.env.DEV ? lazy(() => import('./sandbox/SandboxTv')) : null;

function TvFallback() {
  return <div style={{ position: 'fixed', inset: 0, background: '#141416' }} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/event/:eventId" element={<EventPage />} />
        <Route
          path="/event/:eventId/tv"
          element={
            <Suspense fallback={<TvFallback />}>
              <TvPage />
            </Suspense>
          }
        />
        {import.meta.env.DEV && SandboxPhone && SandboxTv ? (
          <>
            <Route
              path="/sandbox/americano/tv"
              element={
                <Suspense fallback={<TvFallback />}>
                  <SandboxTv />
                </Suspense>
              }
            />
            <Route
              path="/sandbox/:eventId"
              element={
                <Suspense fallback={null}>
                  <SandboxPhone />
                </Suspense>
              }
            />
          </>
        ) : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
