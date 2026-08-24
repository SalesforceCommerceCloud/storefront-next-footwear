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
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { PerformanceSpec } from './performance-spec-data';
import {
    CUSHIONING_EXPERIENTIAL_KEY,
    CUSHIONING_SCALE,
    CUSHIONING_TECHNICAL_KEY,
    DOT_SCALE_LENGTH,
    SUPPORT_EXPERIENTIAL_KEY,
    SUPPORT_SCALE,
    SUPPORT_TECHNICAL_KEY,
    TERRAIN_EXPERIENTIAL_KEY,
    TERRAIN_TECHNICAL_KEY,
} from './performance-spec-labels';

export type PerformanceSpecCardDisplayMode = 'technical' | 'experiential';

export interface PerformanceSpecCardProps {
    /** Parsed performance attributes; `undefined`/`null` (or a spec with no resolved fields) renders nothing */
    specs: PerformanceSpec | null | undefined;
    /** Raw values with units (`technical`) vs. static descriptive language (`experiential`) @default 'technical' */
    displayMode?: PerformanceSpecCardDisplayMode;
    className?: string;
}

interface DotScaleProps {
    /** 1-indexed filled-dot count out of `DOT_SCALE_LENGTH` */
    filled: number;
    /** Visible text equivalent rendered next to the dots — never color/glyph alone */
    label: string;
}

/** Filled/unfilled dot row with a mandatory visible text label as its accessible equivalent. */
function DotScale({ filled, label }: DotScaleProps): ReactElement {
    return (
        <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-flex gap-1">
                {Array.from({ length: DOT_SCALE_LENGTH }, (_, index) => (
                    <span
                        key={index}
                        className={cn(
                            'inline-block size-2 rounded-full',
                            index < filled ? 'bg-foreground' : 'bg-muted'
                        )}
                    />
                ))}
            </span>
            <span>{label}</span>
        </span>
    );
}

interface SpecRowProps {
    term: string;
    children: ReactNode;
}

function SpecRow({ term, children }: SpecRowProps): ReactElement {
    return (
        <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{term}</dt>
            <dd className="text-sm font-semibold text-foreground">{children}</dd>
        </div>
    );
}

/**
 * PDP performance spec bar for footwear. Renders cushioning, heel-to-toe drop, weight,
 * support type, and terrain as a `<dl>` of key/value pairs, in either `technical` (raw
 * values with units) or `experiential` (static descriptive copy, no AI/network call) mode.
 *
 * Renders nothing when no performance attributes resolve on the product — never an empty
 * shell. Desktop shows the full spec list inline below the PDP hero; below `md` it collapses
 * into an accordion behind a "View Specs" trigger revealing the same `<dl>` content.
 */
export function PerformanceSpecCard({
    specs,
    displayMode = 'technical',
    className,
}: PerformanceSpecCardProps): ReactElement | null {
    const { t } = useTranslation('product');

    if (!specs || Object.keys(specs).length === 0) return null;

    const { cushioning, heelToeDrop, weight, supportType, terrain } = specs;
    const isTechnical = displayMode === 'technical';

    const rows: ReactElement[] = [];

    if (cushioning) {
        const technical = t(CUSHIONING_TECHNICAL_KEY[cushioning].key, {
            defaultValue: CUSHIONING_TECHNICAL_KEY[cushioning].defaultValue,
        });
        rows.push(
            <SpecRow key="cushioning" term={t('performanceSpecs.cushioning.label', { defaultValue: 'Cushioning' })}>
                {isTechnical ? (
                    <DotScale filled={CUSHIONING_SCALE[cushioning]} label={technical} />
                ) : (
                    t(CUSHIONING_EXPERIENTIAL_KEY[cushioning].key, {
                        defaultValue: CUSHIONING_EXPERIENTIAL_KEY[cushioning].defaultValue,
                    })
                )}
            </SpecRow>
        );
    }

    if (typeof heelToeDrop === 'number') {
        rows.push(
            <SpecRow
                key="heelToeDrop"
                term={t('performanceSpecs.heelToeDrop.label', { defaultValue: 'Heel-to-Toe Drop' })}>
                {isTechnical
                    ? t('performanceSpecs.heelToeDrop.value', { mm: heelToeDrop, defaultValue: '{{mm}} mm' })
                    : t('performanceSpecs.heelToeDrop.experiential', {
                          mm: heelToeDrop,
                          defaultValue: '{{mm}} mm offset from heel to toe',
                      })}
            </SpecRow>
        );
    }

    if (typeof weight === 'number') {
        rows.push(
            <SpecRow key="weight" term={t('performanceSpecs.weight.label', { defaultValue: 'Weight' })}>
                {t('performanceSpecs.weight.value', { g: weight, defaultValue: '{{g}} g' })}
            </SpecRow>
        );
    }

    if (supportType) {
        const technical = t(SUPPORT_TECHNICAL_KEY[supportType].key, {
            defaultValue: SUPPORT_TECHNICAL_KEY[supportType].defaultValue,
        });
        rows.push(
            <SpecRow key="supportType" term={t('performanceSpecs.support.label', { defaultValue: 'Support' })}>
                {isTechnical ? (
                    <DotScale filled={SUPPORT_SCALE[supportType]} label={technical} />
                ) : (
                    t(SUPPORT_EXPERIENTIAL_KEY[supportType].key, {
                        defaultValue: SUPPORT_EXPERIENTIAL_KEY[supportType].defaultValue,
                    })
                )}
            </SpecRow>
        );
    }

    if (terrain) {
        rows.push(
            <SpecRow key="terrain" term={t('performanceSpecs.terrain.label', { defaultValue: 'Terrain' })}>
                {isTechnical
                    ? t(TERRAIN_TECHNICAL_KEY[terrain].key, {
                          defaultValue: TERRAIN_TECHNICAL_KEY[terrain].defaultValue,
                      })
                    : t(TERRAIN_EXPERIENTIAL_KEY[terrain].key, {
                          defaultValue: TERRAIN_EXPERIENTIAL_KEY[terrain].defaultValue,
                      })}
            </SpecRow>
        );
    }

    if (rows.length === 0) return null;

    const specList = <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">{rows}</dl>;

    return (
        <div className={cn('w-full border-t border-border pt-6', className)}>
            {/* Desktop: horizontal spec bar, always visible */}
            <div className="hidden md:block">
                <h2 className="mb-4 text-base font-semibold text-foreground">
                    {t('performanceSpecs.title', { defaultValue: 'Performance Specs' })}
                </h2>
                {specList}
            </div>

            {/* Mobile: collapsed behind a "View Specs" accordion trigger */}
            <div className="md:hidden">
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="performance-specs">
                        <AccordionTrigger className="text-left font-semibold text-sm">
                            {t('performanceSpecs.viewSpecsTrigger', { defaultValue: 'View Specs' })}
                        </AccordionTrigger>
                        <AccordionContent>{specList}</AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
}

PerformanceSpecCard.displayName = 'PerformanceSpecCard';
