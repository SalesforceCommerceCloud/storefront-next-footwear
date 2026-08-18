/**
 * Copyright 2026 Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { SizeChartEntry, SizeGuideGender } from './size-chart-data';

const GENDER_LABEL_DEFAULTS: Record<SizeGuideGender, string> = {
    mens: "Men's",
    womens: "Women's",
    kids: 'Kids',
};

export interface SizeConversionTableProps {
    /** Rows to render, already resolved (product-specific or the static fallback) */
    entries: SizeChartEntry[];
    gender: SizeGuideGender;
    /** US size to visually + programmatically highlight, e.g. the shopper's current PDP selection */
    highlightSize?: string;
    /**
     * Applied to every EU column value before display (e.g. a brand that runs a half-size
     * large across its whole line). Purely additive to the shipped conversion; does not
     * touch US/UK/CM.
     */
    brandOffset?: number;
}

/**
 * Semantic size-conversion table (US/UK/EU/CM, +JP where available). Only ever rendered
 * inside SizeGuideDrawer.
 */
export function SizeConversionTable({
    entries,
    gender,
    highlightSize,
    brandOffset = 0,
}: SizeConversionTableProps): ReactElement {
    const { t } = useTranslation('product');
    const hasJp = entries.some((entry) => entry.jp !== undefined);

    return (
        <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
                {t('sizeGuide.conversionTableCaption', {
                    gender: t(`sizeGuide.gender.${gender}`, { defaultValue: GENDER_LABEL_DEFAULTS[gender] }),
                    defaultValue: '{{gender}} size conversion chart: US, UK, EU, and CM sizes',
                })}
            </caption>
            <thead>
                <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-card-foreground">
                        {t('sizeGuide.us', { defaultValue: 'US' })}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-card-foreground">
                        {t('sizeGuide.uk', { defaultValue: 'UK' })}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-card-foreground">
                        {t('sizeGuide.eu', { defaultValue: 'EU' })}
                    </th>
                    <th scope="col" className="py-2 pr-3 text-left font-semibold text-card-foreground">
                        {t('sizeGuide.cm', { defaultValue: 'CM' })}
                    </th>
                    {hasJp && (
                        <th scope="col" className="py-2 text-left font-semibold text-card-foreground">
                            {t('sizeGuide.jp', { defaultValue: 'JP' })}
                        </th>
                    )}
                </tr>
            </thead>
            <tbody>
                {entries.map((entry) => {
                    const isHighlighted = highlightSize !== undefined && entry.us === highlightSize;
                    const eu = applyBrandOffset(entry.eu, brandOffset);

                    return (
                        <tr
                            key={entry.us}
                            aria-current={isHighlighted ? 'true' : undefined}
                            className={cn(
                                'border-b border-border last:border-b-0',
                                isHighlighted && 'bg-accent font-semibold'
                            )}>
                            <th scope="row" className="py-2 pr-3 text-left font-normal">
                                {entry.us}
                                {isHighlighted && (
                                    <span className="sr-only">
                                        {' '}
                                        {t('sizeGuide.yourSize', { defaultValue: '(your size)' })}
                                    </span>
                                )}
                            </th>
                            <td className="py-2 pr-3">{entry.uk}</td>
                            <td className="py-2 pr-3">{eu}</td>
                            <td className="py-2 pr-3">{entry.cm}</td>
                            {hasJp && <td className="py-2">{entry.jp ?? '—'}</td>}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function applyBrandOffset(euSize: string, offset: number): string {
    if (offset === 0) return euSize;
    const numeric = Number.parseFloat(euSize);
    if (Number.isNaN(numeric)) return euSize;
    return String(numeric + offset);
}
