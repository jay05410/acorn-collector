import { ChevronLeft, Nut, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { t, useLanguage } from '@/i18n';

interface HeaderProps {
  currentView: string;
  onBack: () => void;
  showBack: boolean;
  onAddClick: () => void;
  onSettingsClick: () => void;
}

export function Header({
  currentView,
  onBack,
  showBack,
  onAddClick,
  onSettingsClick,
}: HeaderProps) {
  useLanguage();

  const getTitle = () => {
    switch (currentView) {
      case 'booth-detail':
        return t('booths', 'title');
      default:
        return t('common', 'appName');
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {showBack ? (
          <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('common', 'back')}>
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
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddClick}
          aria-label={t('common', 'add')}
          className="dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Plus className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          aria-label={t('settings', 'title')}
          className="dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
