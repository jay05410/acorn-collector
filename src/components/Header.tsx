import { ChevronLeft, Plus, Settings } from 'lucide-react';
import { AcornMark } from '@/components/ui/AcornMark';
import { IconButton } from '@/components/ui/IconButton';
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

  const title =
    currentView === 'booth-detail'
      ? t('booths', 'title')
      : t('common', 'appName');

  return (
    <header className="sticky top-0 z-(--z-sticky) flex h-13 shrink-0 items-center gap-1 border-b border-line bg-surface px-2">
      {showBack ? (
        <IconButton label={t('common', 'back')} onClick={onBack}>
          <ChevronLeft />
        </IconButton>
      ) : (
        <AcornMark className="mx-1" />
      )}
      <h1 className="min-w-0 flex-1 truncate px-1 text-base font-semibold text-fg">
        {title}
      </h1>
      <IconButton label={t('booths', 'addBooth')} onClick={onAddClick}>
        <Plus />
      </IconButton>
      <IconButton label={t('settings', 'title')} onClick={onSettingsClick}>
        <Settings />
      </IconButton>
    </header>
  );
}
