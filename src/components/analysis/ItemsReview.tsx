import { useId, type Dispatch, type ReactNode } from 'react';
import { CopyPlus } from 'lucide-react';
import { useBadges } from '@/hooks/useBadges';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencySelect } from '@/components/ui/CurrencySelect';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stepper } from '@/components/ui/Stepper';
import { MAX_ITEM_QUANTITY } from '@/constants/items';
import {
  formatPrice,
  getBadgeLabel,
  getCategoryLabel,
  t,
  tp,
  useLanguage,
} from '@/i18n';
import { cn } from '@/lib/utils';
import {
  currencyUnknown,
  includedRows,
  reviewTotals,
  rowCurrency,
  rowName,
  rowPrice,
  selectedOption,
  type ReviewAction,
  type ReviewRow,
  type RowPatch,
} from './items-review-state';

interface ItemsReviewProps {
  rows: readonly ReviewRow[];
  dispatch: Dispatch<ReviewAction>;
  /** Event currency; rows without their own are priced in it. */
  fallbackCurrency: string;
  badgeId: string;
  onBadgeChange: (badgeId: string) => void;
  /** Items are still arriving: placeholder rows are shown. */
  loading: boolean;
  /** Shown instead of the list when there are no rows and nothing is loading. */
  empty?: ReactNode;
  /** Status line or banner shown above the rows. */
  header?: ReactNode;
}

/**
 * Review list for extracted items: include, rename, pick an option, set the
 * quantity and price, then choose the badge every added item gets.
 */
export function ItemsReview({
  rows,
  dispatch,
  fallbackCurrency,
  badgeId,
  onBadgeChange,
  loading,
  empty,
  header,
}: ItemsReviewProps) {
  useLanguage();
  const headingId = useId();
  const { badges } = useBadges();
  const included = includedRows(rows);
  const allIncluded = rows.length > 0 && rows.every((row) => row.included);
  const totals = reviewTotals(rows, fallbackCurrency);

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div className="flex min-h-11 items-center gap-2 px-1">
        <h3 id={headingId} className="text-sm font-semibold text-fg">
          {t('review', 'itemsTitle')}
          {rows.length > 0 && (
            <span className="ms-1.5 text-fg-subtle tabular-nums">{rows.length}</span>
          )}
        </h3>
        {rows.length > 0 && (
          <label className="ml-auto flex cursor-pointer items-center text-sm text-fg-muted">
            <span>{t('review', 'selectAll')}</span>
            <Checkbox
              checked={allIncluded}
              onCheckedChange={(checked) => dispatch({ type: 'setAll', included: checked })}
              className="-mr-2.5"
            />
          </label>
        )}
      </div>

      {header}

      {rows.length === 0 && !loading && empty}

      {(rows.length > 0 || loading) && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
          {rows.map((row, index) => (
            <ReviewRowView
              key={row.key}
              row={row}
              index={index}
              fallbackCurrency={fallbackCurrency}
              dispatch={dispatch}
            />
          ))}
          {loading && <SkeletonRows count={rows.length === 0 ? 3 : 1} />}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="space-y-3 rounded-xl bg-surface-sunken px-3 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
            <span className="text-fg-muted">
              {tp('analysis', 'selectedCount', { count: included.length })}
            </span>
            {totals.length > 0 && !loading && (
              <span className="flex flex-wrap justify-end gap-x-2 font-semibold text-fg tabular-nums">
                <span className="sr-only">{t('review', 'total')}: </span>
                {totals.map((total) => (
                  <span key={total.currency}>{formatPrice(total.total, total.currency)}</span>
                ))}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            <p aria-hidden="true" className="text-[13px] font-medium text-fg">
              {t('review', 'addAs')}
            </p>
            <SegmentedControl
              variant="chips"
              aria-label={t('review', 'addAs')}
              value={badgeId}
              onChange={onBadgeChange}
              options={badges.map((badge) => ({
                value: badge.id,
                label: getBadgeLabel(badge),
                color: badge.color,
              }))}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} aria-hidden="true" className="flex items-start gap-1 py-3 pr-3 pl-0.5">
          <span className="flex size-11 shrink-0 items-center justify-center">
            <Skeleton className="size-5 rounded-md" />
          </span>
          <span className="flex flex-1 flex-col gap-2 pt-2.5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </span>
          <Skeleton className="mt-2.5 h-4 w-14" />
        </li>
      ))}
    </>
  );
}

interface ReviewRowViewProps {
  row: ReviewRow;
  index: number;
  fallbackCurrency: string;
  dispatch: Dispatch<ReviewAction>;
}

function ReviewRowView({ row, index, fallbackCurrency, dispatch }: ReviewRowViewProps) {
  const name = rowName(row);
  const label = name.trim() || tp('review', 'itemNumber', { index: index + 1 });
  const currency = rowCurrency(row, fallbackCurrency);
  const option = selectedOption(row);
  const options = row.source.options;
  const original = row.source.originalName;
  const showOriginal = original !== null && original !== name;
  const price = rowPrice(row);
  // The source never said which currency this price is in (its analysis
  // stopped early): mark it, and let the user pick one.
  const sourceUnknown = row.sourceCurrency === undefined;
  const unknown = currencyUnknown(row);
  const edit = (patch: RowPatch) => dispatch({ type: 'edit', key: row.key, patch });

  return (
    <li
      className={cn(
        'flex items-start gap-1 py-1.5 pr-3 pl-0.5 motion-safe:animate-reveal',
        !row.included && 'bg-surface-sunken/50'
      )}
    >
      <Checkbox
        checked={row.included}
        onCheckedChange={() => dispatch({ type: 'toggle', key: row.key })}
        aria-label={tp('review', 'includeItem', { name: label })}
      />
      <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
        <Input
          value={name}
          onChange={(event) => edit({ name: event.target.value })}
          aria-label={tp('review', 'itemNameOf', { index: index + 1 })}
          className={cn(
            'h-10 border-transparent bg-transparent px-2 font-medium shadow-none hover:border-line-strong',
            !row.included && 'text-fg-muted'
          )}
        />
        {(showOriginal || row.source.category !== 'other') && (
          <p className="flex min-w-0 items-center gap-1.5 px-2 text-xs text-fg-subtle">
            {showOriginal && (
              <span className="min-w-0 truncate">
                <span className="sr-only">{t('review', 'originalName')}: </span>
                {original}
              </span>
            )}
            {row.source.category !== 'other' && (
              <Badge tone="neutral" className="shrink-0">
                {getCategoryLabel(row.source.category)}
              </Badge>
            )}
          </p>
        )}
        {row.included ? (
          <div className="flex flex-wrap items-center gap-2 px-0.5 pb-1.5">
            <Input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={row.price ?? (row.source.price === null ? '' : String(row.source.price))}
              onChange={(event) => edit({ price: event.target.value })}
              placeholder={t('review', 'noPrice')}
              trailing={
                sourceUnknown ? (
                  unknown ? (
                    <span aria-hidden="true" className="font-semibold text-warning">
                      ?
                    </span>
                  ) : undefined
                ) : (
                  currency
                )
              }
              aria-label={tp('review', 'priceOf', { name: label })}
              className="w-32 tabular-nums"
            />
            {sourceUnknown && (
              <CurrencySelect
                value={currency}
                onChange={(code) => edit({ currency: code })}
                aria-label={tp('review', 'currencyOf', { name: label })}
                className="w-24"
              />
            )}
            <Stepper
              value={row.quantity}
              onChange={(quantity) => edit({ quantity })}
              max={MAX_ITEM_QUANTITY}
              aria-label={tp('review', 'quantityOf', { name: label })}
              className="w-32"
            />
            {options.length > 0 && (
              <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
                <Select
                  value={option ?? ''}
                  onChange={(event) => edit({ option: event.target.value || null })}
                  aria-label={tp('review', 'optionOf', { name: label })}
                  className="min-w-0 flex-1"
                >
                  {options.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
                {options.length > 1 && (
                  <IconButton
                    variant="secondary"
                    label={tp('review', 'addVariantOf', { name: label })}
                    onClick={() => dispatch({ type: 'duplicate', key: row.key })}
                  >
                    <CopyPlus />
                  </IconButton>
                )}
              </div>
            )}
            {unknown && (
              <p className="basis-full px-1.5 text-xs text-warning">
                {tp('review', 'currencyUnknown', { currency })}
              </p>
            )}
          </div>
        ) : (
          <p className="px-2 pb-1.5 text-xs text-fg-subtle tabular-nums">
            {[
              price !== null ? formatPrice(price, currency) : null,
              option,
              row.known ? t('review', 'alreadyAdded') : null,
            ]
              .filter(Boolean)
              .join(' · ') || t('review', 'excluded')}
          </p>
        )}
      </div>
    </li>
  );
}
