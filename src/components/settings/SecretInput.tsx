import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Input, type InputProps } from '@/components/ui/Input';
import { t, useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * API key field: masked by default with a show/hide toggle. Password
 * managers are asked to leave it alone; the value is never logged.
 */
export const SecretInput = forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'type' | 'trailing'>
>(({ className, ...props }, ref) => {
  useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore="true"
        data-lpignore="true"
        className={cn('pr-12 font-mono text-[13px]', className)}
        {...props}
      />
      <IconButton
        label={visible ? t('aiConnect', 'hideKey') : t('aiConnect', 'showKey')}
        aria-pressed={visible}
        size="sm"
        onClick={() => setVisible((value) => !value)}
        className="absolute top-1/2 right-1.5 -translate-y-1/2"
      >
        {visible ? <EyeOff /> : <Eye />}
      </IconButton>
    </div>
  );
});

SecretInput.displayName = 'SecretInput';
