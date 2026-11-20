import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth.tsx';
import { ThemeProvider } from '../lib/theme.tsx';
import { AppShell } from '../components/layout/AppShell.tsx';
import { Spinner } from '../components/ui/Spinner.tsx';

const HomePage = lazy(() => import('../pages/HomePage.tsx'));
const PlayPage = lazy(() => import('../pages/PlayPage.tsx'));
const OnlinePlayPage = lazy(() => import('../pages/OnlinePlayPage.tsx'));
const BotPlayPage = lazy(() => import('../pages/BotPlayPage.tsx'));
const GamePage = lazy(() => import('../pages/GamePage.tsx'));
const PuzzlesPage = lazy(() => import('../pages/PuzzlesPage.tsx'));
const LearnPage = lazy(() => import('../pages/LearnPage.tsx'));
const LeaderboardPage = lazy(() => import('../pages/LeaderboardPage.tsx'));
const ProfilePage = lazy(() => import('../pages/ProfilePage.tsx'));
const GamesPage = lazy(() => import('../pages/GamesPage.tsx'));
const FriendsPage = lazy(() => import('../pages/FriendsPage.tsx'));
const SettingsPage = lazy(() => import('../pages/SettingsPage.tsx'));
const LoginPage = lazy(() => import('../pages/LoginPage.tsx'));
const RegisterPage = lazy(() => import('../pages/RegisterPage.tsx'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage.tsx'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage.tsx'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.tsx'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteFallback() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Spinner size={28} />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/play" element={<PlayPage />} />
                <Route path="/play/online" element={<OnlinePlayPage />} />
                <Route path="/play/bot" element={<BotPlayPage />} />
                <Route path="/game/:id" element={<GamePage />} />
                <Route path="/puzzles" element={<PuzzlesPage />} />
                <Route path="/learn" element={<LearnPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/profile/:username" element={<ProfilePage />} />
                <Route path="/games" element={<GamesPage />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot" element={<ForgotPasswordPage />} />
                <Route path="/reset/:token" element={<ResetPasswordPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            </AppShell>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
