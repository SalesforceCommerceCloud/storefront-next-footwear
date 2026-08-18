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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SizeGuideContent } from './size-guide-content';
import type { SizeChartEntry } from './size-chart-data';

// Footwear-vertical strings aren't in the canonical resources vitest.setup.ts initializes
// (VERTICAL isn't set for `pnpm test`), so mock react-i18next directly, mirroring the
// established pattern in this vertical's home route test.
vi.mock('react-i18next', async () => {
    const actual: any = await vi.importActual('react-i18next');
    const translations: Record<string, string> = {
        'sizeGuide.genderToggleLabel': 'Select gender',
        'sizeGuide.gender.mens': "Men's",
        'sizeGuide.gender.womens': "Women's",
        'sizeGuide.gender.kids': 'Kids',
        'sizeGuide.tabsLabel': 'Size guide sections',
        'sizeGuide.tabs.sizeChart': 'Size chart',
        'sizeGuide.tabs.howToMeasure': 'How to measure',
        'sizeGuide.conversionTableCaption': '{{gender}} size conversion chart: US, UK, EU, and CM sizes',
        'sizeGuide.us': 'US',
        'sizeGuide.uk': 'UK',
        'sizeGuide.eu': 'EU',
        'sizeGuide.cm': 'CM',
        'sizeGuide.jp': 'JP',
        'sizeGuide.yourSize': '(your size)',
        'sizeGuide.howToMeasure.step1': 'Trace your foot on a piece of paper.',
        'sizeGuide.howToMeasure.step2': 'Measure the longest length in centimeters.',
        'sizeGuide.howToMeasure.step3': 'Measure the widest width in centimeters.',
        'sizeGuide.howToMeasure.step4': 'Compare against the chart above.',
    };
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: Record<string, string>) => {
                const value = translations[key] ?? key;
                if (options) {
                    return value.replace(/\{\{(\w+)\}\}/g, (_match, prop) => options[prop] ?? `{{${prop}}}`);
                }
                return value;
            },
            i18n: { language: 'en-US', changeLanguage: vi.fn() },
        }),
    };
});

const mensChart: SizeChartEntry[] = [{ us: '9', uk: '8', eu: '42.5', cm: '27' }];

describe('SizeGuideContent', () => {
    it('renders the size chart tab active by default', () => {
        render(<SizeGuideContent sizeChart={mensChart} gender="mens" />);
        expect(screen.getByRole('tab', { name: 'Size chart' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tabpanel', { name: 'Size chart' })).toBeVisible();
    });

    it('marks the initial gender as pressed', () => {
        render(<SizeGuideContent sizeChart={mensChart} gender="mens" />);
        expect(screen.getByRole('button', { name: "Men's" })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: "Women's" })).toHaveAttribute('aria-pressed', 'false');
    });

    it('switches to the how-to-measure tab on click', async () => {
        const user = userEvent.setup();
        render(<SizeGuideContent sizeChart={mensChart} gender="mens" />);
        await user.click(screen.getByRole('tab', { name: 'How to measure' }));
        expect(screen.getByRole('tab', { name: 'How to measure' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tabpanel', { name: 'How to measure' })).toBeVisible();
        expect(screen.getByText('Trace your foot on a piece of paper.')).toBeInTheDocument();
    });

    it('moves to the next tab with the right arrow key', async () => {
        const user = userEvent.setup();
        render(<SizeGuideContent sizeChart={mensChart} gender="mens" />);
        screen.getByRole('tab', { name: 'Size chart' }).focus();
        await user.keyboard('{ArrowRight}');
        expect(screen.getByRole('tab', { name: 'How to measure' })).toHaveAttribute('aria-selected', 'true');
    });

    it('wraps to the last tab with the left arrow key from the first tab', async () => {
        const user = userEvent.setup();
        render(<SizeGuideContent sizeChart={mensChart} gender="mens" />);
        screen.getByRole('tab', { name: 'Size chart' }).focus();
        await user.keyboard('{ArrowLeft}');
        expect(screen.getByRole('tab', { name: 'How to measure' })).toHaveAttribute('aria-selected', 'true');
    });

    it('switches to the default kids chart when the kids gender toggle is clicked', async () => {
        const user = userEvent.setup();
        render(<SizeGuideContent sizeChart={mensChart} gender="mens" />);
        await user.click(screen.getByRole('button', { name: 'Kids' }));
        expect(screen.getByRole('button', { name: 'Kids' })).toHaveAttribute('aria-pressed', 'true');
        // switching away from the initially-active gender falls back to the static default chart
        expect(screen.getByText(/Kids size conversion chart/)).toBeInTheDocument();
    });

    it('reverts to the passed-in sizeChart when toggling back to the initial gender', async () => {
        const user = userEvent.setup();
        render(<SizeGuideContent sizeChart={mensChart} gender="mens" />);
        await user.click(screen.getByRole('button', { name: 'Kids' }));
        await user.click(screen.getByRole('button', { name: "Men's" }));
        expect(screen.getByRole('rowheader', { name: '9' })).toBeInTheDocument();
    });

    it('renders brandSizeNotes when provided', () => {
        render(<SizeGuideContent sizeChart={mensChart} gender="mens" brandSizeNotes="Runs half a size small." />);
        expect(screen.getByText('Runs half a size small.')).toBeInTheDocument();
    });

    it('does not render a brand notes paragraph when brandSizeNotes is omitted', () => {
        render(<SizeGuideContent sizeChart={mensChart} gender="mens" />);
        expect(screen.queryByText(/Runs/)).not.toBeInTheDocument();
    });
});
