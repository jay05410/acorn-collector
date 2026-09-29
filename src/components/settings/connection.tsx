/**
 * Pieces shared by the provider panels: the key form, the connection test
 * result and outbound links.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { ExternalLink } from '@/components/support/ExternalLink';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { t, tp, useLanguage } from '@/i18n';
import type { ApiProviderId } from '@/lib/ai/models';
import { cn } from '@/lib/utils';
import { PROVIDER_KEY_PLACEHOLDERS } from './links';
import type { ConnectionTestState } from './connection-test';
import { providerName } from './providers';
import { SecretInput } from './SecretInput';

export function ConnectionTestResult({
  state,
  provider,
}: {
  state: ConnectionTestState;
  provider: ApiProviderId;
}) {
  useLanguage();
  if (state.status === 'ok') {
    return (
      <Banner tone="success">
        {tp('aiConnect', 'testOk', { provider: providerName(provider) })}
      </Banner>
    );
  }
  if (state.status === 'error') {
    return (
      <Banner tone="error" title={t('aiConnect', 'testFailed')}>
        {state.message}
      </Banner>
    );
  }
  return null;
}

export const LINK_CLASS =
  'inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-medium text-primary-strong underline-offset-4 hover:underline [&_svg]:size-3.5 [&_svg]:shrink-0';

export function OutboundLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ExternalLink href={href} className={cn(LINK_CLASS, className)}>
      {children}
      <ArrowUpRight aria-hidden="true" />
    </ExternalLink>
  );
}

interface KeyFormProps {
  provider: ApiProviderId;
  label: string;
  hint?: string;
  /** Resolves true when the key was saved; the field is then cleared. */
  onSave: (key: string) => Promise<boolean>;
  onCancel?: () => void;
  autoFocus?: boolean;
}

/** Masked key input with Save (and optional Cancel). */
export function KeyForm({
  provider,
  label,
  hint,
  onSave,
  onCancel,
  autoFocus,
}: KeyFormProps) {
  useLanguage();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const key = draft.trim();
    if (key === '') {
      setError(t('aiConnect', 'keyRequired'));
      return;
    }
    setSaving(true);
    const saved = await onSave(key);
    if (!mounted.current) return;
    setSaving(false);
    if (saved) setDraft('');
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field label={label} hint={hint} error={error}>
        <SecretInput
          value={draft}
          autoFocus={autoFocus}
          placeholder={PROVIDER_KEY_PLACEHOLDERS[provider]}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={saving}>
          {t('aiConnect', 'saveKey')}
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('common', 'cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
