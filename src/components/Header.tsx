import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  Nut,
  Plus,
  Settings,
  User,
  Coins,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { useAuthStore } from '@/stores/useAuthStore';
import type { AuthProvider } from '@/lib/auth';

interface HeaderProps {
  currentView: string;
  onBack: () => void;
  showBack: boolean;
  onAddClick: () => void;
  onSettingsClick: () => void;
  onCreditClick?: () => void;
}

export function Header({
  currentView,
  onBack,
  showBack,
  onAddClick,
  onSettingsClick,
  onCreditClick,
}: HeaderProps) {
  const { isAuthenticated, credits, user, signIn } = useAuthStore();
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowLoginMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = async (provider: AuthProvider) => {
    setShowLoginMenu(false);
    setLoginLoading(true);
    try {
      await signIn(provider);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoginLoading(false);
    }
  };

  const getTitle = () => {
    switch (currentView) {
      case 'events':
        return t('settings', 'version');
      case 'booth-detail':
        return t('booths', 'title');
      default:
        return t('settings', 'version');
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {showBack ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="뒤로가기"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        ) : (
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
            <Nut className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
        )}
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          {getTitle()}
        </h1>
      </div>
      <div className="flex items-center gap-1">
        {isAuthenticated && (
          <button
            onClick={onCreditClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 transition-colors"
            title={user?.email}
          >
            <Coins className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              {credits.toLocaleString()}
            </span>
          </button>
        )}
        {!isAuthenticated && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowLoginMenu(!showLoginMenu)}
              disabled={loginLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm text-gray-600 disabled:opacity-50"
            >
              {loginLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <User className="w-4 h-4" />
              )}
              로그인
            </button>
            {showLoginMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                <button
                  onClick={() => handleLogin('google')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google 계정
                </button>
                <button
                  onClick={() => handleLogin('twitter')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  X (Twitter)
                </button>
              </div>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddClick}
          aria-label="추가"
          className="dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Plus className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          aria-label="설정"
          className="dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
