import { ChevronLeft, Plus, ScanText, Settings } from 'lucide-react';
import { AcornMark } from '@/components/ui/AcornMark';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { t, useLanguage } from '@/i18n';

interface HeaderProps {
  currentView: string;
  onBack: () => void;
  showBack: boolean;
  onAddClick: () => void;
  onSettingsClick: () => void;
  /** Captures the active tab of this window. */
  onCaptureClick: () => void;
  /** A capture is in progress. */
  capturing?: boolean;
}

export function Header({
  currentView,
  onBack,
  showBack,
  onAddClick,
  onSettingsClick,
  onCaptureClick,
  capturing = false,
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
      {/* gap-2: the 44px hit areas of the 36px buttons must not overlap. */}
      <div className="flex shrink-0 items-center gap-2">
        <IconButton
          label={capturing ? t('capture', 'capturing') : t('capture', 'captureButton')}
          onClick={onCaptureClick}
          aria-busy={capturing || undefined}
          disabled={capturing}
          className="disabled:opacity-100"
        >
          {capturing ? <Spinner className="size-[1.125rem]" /> : <ScanText />}
        </IconButton>
        <IconButton label={t('booths', 'addBooth')} onClick={onAddClick}>
          <Plus />
        </IconButton>
        <IconButton label={t('settings', 'title')} onClick={onSettingsClick}>
          <Settings />
        </IconButton>
      </div>
    </header>
  );
}
