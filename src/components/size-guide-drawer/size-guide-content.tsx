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
import { useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SizeConversionTable } from './size-conversion-table';
import { DEFAULT_SIZE_CHARTS, type SizeChartEntry, type SizeGuideGender } from './size-chart-data';

export interface SizeGuideContentProps {
    /** Conversion rows for the initially-active gender — parsed `c_sizeChart` or the shipped fallback */
    sizeChart: SizeChartEntry[];
    gender: SizeGuideGender;
    brandSizeNotes?: string;
    /** The shopper's currently-selected US size, if any (soft-dependent on PDP size selection state) */
    highlightSize?: string;
}

const GENDERS: SizeGuideGender[] = ['mens', 'womens', 'kids'];
const TABS = ['sizeChart', 'howToMeasure'] as const;
type TabKey = (typeof TABS)[number];

const GENDER_LABEL_DEFAULTS: Record<SizeGuideGender, string> = {
    mens: "Men's",
    womens: "Women's",
    kids: 'Kids',
};

const TAB_LABEL_DEFAULTS: Record<TabKey, string> = {
    sizeChart: 'Size Chart',
    howToMeasure: 'How to Measure',
};

/**
 * Gender toggle + US/UK/EU/CM (+JP) conversion table + "How to Measure" tab. Shared by
 * SizeGuideDrawer (PDP sheet) and the standalone `/size-guide` route so both surfaces render
 * identical conversion content, per the WI's crawlable-page AC.
 */
export function SizeGuideContent({
    sizeChart,
    gender,
    brandSizeNotes,
    highlightSize,
}: SizeGuideContentProps): ReactElement {
    const { t } = useTranslation('product');
    const [activeGender, setActiveGender] = useState<SizeGuideGender>(gender);
    const [activeTab, setActiveTab] = useState<TabKey>('sizeChart');
    const tabListRef = useRef<HTMLDivElement>(null);
    const tabsId = useId();

    const entries = activeGender === gender ? sizeChart : DEFAULT_SIZE_CHARTS[activeGender];

    const onTabKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();

        const currentIndex = TABS.indexOf(activeTab);
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (currentIndex + direction + TABS.length) % TABS.length;
        const nextTab = TABS[nextIndex];
        setActiveTab(nextTab);

        const nextTabEl = tabListRef.current?.children[nextIndex] as HTMLElement | undefined;
        nextTabEl?.focus();
    };

    return (
        <div>
            <div
                className="mb-4 flex gap-2"
                role="group"
                aria-label={t('sizeGuide.genderToggleLabel', { defaultValue: 'Select gender' })}>
                {GENDERS.map((genderOption) => (
                    <button
                        key={genderOption}
                        type="button"
                        aria-pressed={activeGender === genderOption}
                        onClick={() => setActiveGender(genderOption)}
                        className={cn(
                            'min-h-11 flex-1 rounded-md border px-3 text-sm font-medium transition-colors',
                            activeGender === genderOption
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background text-foreground hover:border-border-subtle'
                        )}>
                        {t(`sizeGuide.gender.${genderOption}`, {
                            defaultValue: GENDER_LABEL_DEFAULTS[genderOption],
                        })}
                    </button>
                ))}
            </div>

            <div
                ref={tabListRef}
                role="tablist"
                tabIndex={-1}
                aria-label={t('sizeGuide.tabsLabel', { defaultValue: 'Size guide sections' })}
                onKeyDown={onTabKeyDown}
                className="mb-4 flex gap-1 border-b border-border">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        id={`${tabsId}-tab-${tab}`}
                        aria-selected={activeTab === tab}
                        aria-controls={`${tabsId}-panel-${tab}`}
                        tabIndex={activeTab === tab ? 0 : -1}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            'min-h-11 px-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                            activeTab === tab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}>
                        {t(`sizeGuide.tabs.${tab}`, { defaultValue: TAB_LABEL_DEFAULTS[tab] })}
                    </button>
                ))}
            </div>

            <div
                role="tabpanel"
                id={`${tabsId}-panel-sizeChart`}
                aria-labelledby={`${tabsId}-tab-sizeChart`}
                hidden={activeTab !== 'sizeChart'}>
                <SizeConversionTable entries={entries} gender={activeGender} highlightSize={highlightSize} />
                {brandSizeNotes && <p className="mt-3 text-sm text-muted-foreground">{brandSizeNotes}</p>}
            </div>

            <div
                role="tabpanel"
                id={`${tabsId}-panel-howToMeasure`}
                aria-labelledby={`${tabsId}-tab-howToMeasure`}
                hidden={activeTab !== 'howToMeasure'}>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
                    <li>
                        {t('sizeGuide.howToMeasure.step1', {
                            defaultValue: 'Trace your foot on a piece of paper.',
                        })}
                    </li>
                    <li>
                        {t('sizeGuide.howToMeasure.step2', {
                            defaultValue: 'Measure the longest length in centimeters.',
                        })}
                    </li>
                    <li>
                        {t('sizeGuide.howToMeasure.step3', {
                            defaultValue: 'Measure the widest width in centimeters.',
                        })}
                    </li>
                    <li>
                        {t('sizeGuide.howToMeasure.step4', {
                            defaultValue: 'Compare against the chart above.',
                        })}
                    </li>
                </ol>
            </div>
        </div>
    );
}

SizeGuideContent.displayName = 'SizeGuideContent';
