import { useId, useState, type Dispatch, type KeyboardEvent } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencySelect } from '@/components/ui/CurrencySelect';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { t, useLanguage, type MessageKey } from '@/i18n';
import type { LinkKind } from '@/lib/parser/text';
import type { Event } from '@/types';
import {
  NEW_EVENT,
  normalizeLinkInput,
  type DraftAction,
  type DraftError,
  type DraftState,
} from './capture-draft';

interface BoothFieldsProps {
  state: DraftState;
  dispatch: Dispatch<DraftAction>;
  events: readonly Event[];
  /** Shown after a save attempt. */
  errors: readonly DraftError[];
}

const LINK_KIND_LABELS: Record<LinkKind, MessageKey<'capture'>> = {
  order: 'linkOrder',
  info: 'linkInfo',
  other: 'linkOther',
};

function splitUrl(url: string): { host: string; rest: string } {
  try {
    const parsed = new URL(url);
    const rest = `${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}`;
    return { host: parsed.hostname.replace(/^www\./, ''), rest };
  } catch {
    return { host: url, rest: '' };
  }
}

/** Event, booth number, circle, zone, mail order, links and memo. */
export function BoothFields({ state, dispatch, events, errors }: BoothFieldsProps) {
  useLanguage();
  const headingId = useId();
  const { draft, eventOrigin } = state;
  const set = (patch: Parameters<typeof setAction>[0]) => dispatch(setAction(patch));
  const isNew = draft.eventId === NEW_EVENT;
  const eventHint =
    eventOrigin === 'post'
      ? t('capture', 'eventFromPost')
      : eventOrigin === 'ai'
        ? t('capture', 'eventFromAi')
        : undefined;

  return (
    <Card as="section" aria-labelledby={headingId} className="space-y-3 p-3">
      <h3 id={headingId} className="text-sm font-semibold text-fg">
        {t('capture', 'boothHeading')}
      </h3>

      <Field
        label={t('capture', 'event')}
        hint={
          eventHint && (
            <span className="inline-flex items-center gap-1">
              <Sparkles aria-hidden="true" className="size-3" />
              {eventHint}
            </span>
          )
        }
        error={errors.includes('event') && !isNew ? t('capture', 'eventRequired') : undefined}
      >
        <Select
          value={draft.eventId}
          onChange={(event) => set({ eventId: event.target.value })}
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
          <option value={NEW_EVENT}>{t('capture', 'newEventOption')}</option>
        </Select>
      </Field>

      {isNew && (
        <div className="flex animate-reveal gap-2">
          <Field
            label={t('capture', 'newEventName')}
            required
            className="min-w-0 flex-1"
            error={errors.includes('event') ? t('capture', 'eventRequired') : undefined}
          >
            <Input
              value={draft.newEventName}
              onChange={(event) => set({ newEventName: event.target.value })}
              placeholder={t('events', 'eventNamePlaceholder')}
            />
          </Field>
          <Field label={t('currency', 'label')} className="w-28 shrink-0">
            <CurrencySelect
              value={draft.newEventCurrency}
              onChange={(newEventCurrency) => set({ newEventCurrency })}
            />
          </Field>
        </div>
      )}

      <div className="flex gap-2">
        <Field
          label={t('booths', 'boothNumber')}
          required={!draft.isMailOrder}
          className="w-32 shrink-0"
          error={errors.includes('boothNumber') ? t('capture', 'boothRequired') : undefined}
        >
          <Input
            value={draft.boothNumber}
            onChange={(event) => set({ boothNumber: event.target.value })}
            placeholder={t('booths', 'boothNumberPlaceholder')}
          />
        </Field>
        <Field
          label={t('booths', 'circleName')}
          required
          className="min-w-0 flex-1"
          error={errors.includes('circleName') ? t('capture', 'circleRequired') : undefined}
        >
          <Input
            value={draft.circleName}
            onChange={(event) => set({ circleName: event.target.value })}
            placeholder={t('booths', 'circleNamePlaceholder')}
          />
        </Field>
      </div>

      <div className="flex items-start gap-3">
        <Field label={t('booths', 'zone')} className="min-w-0 flex-1">
          <Input
            value={draft.zone}
            onChange={(event) => set({ zone: event.target.value })}
            placeholder={t('booths', 'zonePlaceholder')}
          />
        </Field>
        <Field label={t('capture', 'mailOrder')} className="shrink-0">
          <div className="flex h-11 items-center">
            <Switch
              checked={draft.isMailOrder}
              onCheckedChange={(isMailOrder) => set({ isMailOrder })}
            />
          </div>
        </Field>
      </div>

      <LinksField state={state} dispatch={dispatch} />

      <Field label={t('booths', 'memo')}>
        <Textarea
          rows={2}
          value={draft.memo}
          onChange={(event) => set({ memo: event.target.value })}
          placeholder={t('booths', 'memoPlaceholder')}
          className="min-h-16"
        />
      </Field>
    </Card>
  );
}

function setAction(patch: Extract<DraftAction, { type: 'set' }>['patch']): DraftAction {
  return { type: 'set', patch };
}

function LinksField({
  state,
  dispatch,
}: {
  state: DraftState;
  dispatch: Dispatch<DraftAction>;
}) {
  const labelId = useId();
  const [input, setInput] = useState('');
  const valid = normalizeLinkInput(input) !== null;

  const add = () => {
    if (!valid) return;
    dispatch({ type: 'addLink', url: input });
    setInput('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  };

  return (
    <div role="group" aria-labelledby={labelId} className="space-y-1.5">
      <p id={labelId} className="text-[13px] leading-5 font-medium text-fg">
        {t('capture', 'links')}
      </p>
      {state.draft.links.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {state.draft.links.map((link) => {
            const { host, rest } = splitUrl(link.url);
            return (
              <li key={link.url} className="flex items-center gap-1 pr-1">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center">
                  <Checkbox
                    checked={link.included}
                    onCheckedChange={() => dispatch({ type: 'toggleLink', url: link.url })}
                  />
                  <span className="min-w-0 flex-1 py-2 pr-1">
                    <span className="block truncate text-sm text-fg">
                      <span className="font-medium">{host}</span>
                      <span className="text-fg-subtle">{rest}</span>
                    </span>
                  </span>
                </label>
                <Badge tone={link.kind === 'order' ? 'primary' : 'neutral'}>
                  {t('capture', LINK_KIND_LABELS[link.kind])}
                </Badge>
                {link.custom && (
                  <IconButton
                    size="sm"
                    label={t('capture', 'removeLink')}
                    onClick={() => dispatch({ type: 'removeLink', url: link.url })}
                  >
                    <X />
                  </IconButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="url"
          inputMode="url"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://"
          aria-label={t('capture', 'addLink')}
          className="h-10"
        />
        <IconButton
          variant="secondary"
          label={t('capture', 'addLink')}
          onClick={add}
          disabled={!valid}
        >
          <Plus />
        </IconButton>
      </div>
    </div>
  );
}
