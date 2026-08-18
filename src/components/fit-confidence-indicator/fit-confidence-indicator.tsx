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
import type { FitFeedback } from './fit-feedback-data';

export interface FitConfidenceIndicatorProps {
    /** Parsed `c_fitFeedback`; `null` means missing/malformed — component renders nothing */
    feedback: FitFeedback | null;
    loading?: boolean;
}

/**
 * Three-segment "runs small / true to size / runs large" bar built from a product's
 * fit-feedback survey data. Per WI graceful-degradation AC, renders nothing (not a
 * placeholder or error state) when `feedback` is `null`.
 */
export function FitConfidenceIndicator({
    feedback,
    loading = false,
}: FitConfidenceIndicatorProps): ReactElement | null {
    const { t } = useTranslation('product');

    if (loading) {
        return <div className="h-12 w-full animate-pulse rounded-md bg-muted" aria-hidden="true" />;
    }

    if (feedback === null) return null;

    const { runsSmallPercent, trueToSizePercent, runsLargePercent, totalResponses } = feedback;

    return (
        <div className="w-full">
            <p className="mb-2 text-sm text-foreground">
                {t('sizeGuide.fitConfidence.summary', {
                    percent: Math.round(trueToSizePercent),
                    count: totalResponses,
                    defaultValue: '{{percent}}% say true to size ({{count}} responses)',
                })}
            </p>
            <div
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(trueToSizePercent)}
                aria-label={t('sizeGuide.fitConfidence.trueToSize', { defaultValue: 'True to size' })}
                className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-border-subtle" style={{ width: `${runsSmallPercent}%` }} />
                <div className="h-full bg-primary" style={{ width: `${trueToSizePercent}%` }} />
                <div className="h-full bg-tertiary" style={{ width: `${runsLargePercent}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span
                    className={cn(
                        runsSmallPercent >= trueToSizePercent &&
                            runsSmallPercent >= runsLargePercent &&
                            'font-semibold text-foreground'
                    )}>
                    {t('sizeGuide.fitConfidence.runsSmall', { defaultValue: 'Runs small' })}
                </span>
                <span
                    className={cn(
                        trueToSizePercent >= runsSmallPercent &&
                            trueToSizePercent >= runsLargePercent &&
                            'font-semibold text-foreground'
                    )}>
                    {t('sizeGuide.fitConfidence.trueToSize', { defaultValue: 'True to size' })}
                </span>
                <span
                    className={cn(
                        runsLargePercent >= runsSmallPercent &&
                            runsLargePercent >= trueToSizePercent &&
                            'font-semibold text-foreground'
                    )}>
                    {t('sizeGuide.fitConfidence.runsLarge', { defaultValue: 'Runs large' })}
                </span>
            </div>
        </div>
    );
}

FitConfidenceIndicator.displayName = 'FitConfidenceIndicator';
