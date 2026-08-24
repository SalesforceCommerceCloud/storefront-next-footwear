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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SizeGuideDrawer } from './size-guide-drawer';
import type { SizeChartEntry } from './size-chart-data';

// Footwear-vertical strings aren't in the canonical resources vitest.setup.ts initializes
// (VERTICAL isn't set for `pnpm test`), so mock react-i18next directly, mirroring the
// established pattern in this vertical's home route test.
vi.mock('react-i18next', async () => {
    const actual: any = await vi.importActual('react-i18next');
    const translations: Record<string, string> = {
        'sizeGuide.title': 'Size guide',
        'sizeGuide.description': 'Find your perfect fit using our size conversion chart.',
        'sizeGuide.descriptionWithBrand': 'Find your perfect fit with {{brandName}} using our size conversion chart.',
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

describe('SizeGuideDrawer', () => {
    it('renders the title and content when open', () => {
        render(<SizeGuideDrawer isOpen sizeChart={mensChart} gender="mens" onClose={vi.fn()} />);
        expect(screen.getByText('Size guide')).toBeInTheDocument();
        expect(screen.getByText('Find your perfect fit using our size conversion chart.')).toBeInTheDocument();
        expect(screen.getByRole('rowheader', { name: '9' })).toBeInTheDocument();
    });

    it('renders nothing when closed', () => {
        render(<SizeGuideDrawer isOpen={false} sizeChart={mensChart} gender="mens" onClose={vi.fn()} />);
        expect(screen.queryByText('Size guide')).not.toBeInTheDocument();
    });

    it('includes the brand name in the description when provided', () => {
        render(
            <SizeGuideDrawer isOpen sizeChart={mensChart} gender="mens" onClose={vi.fn()} brandName="Footwear Next" />
        );
        expect(
            screen.getByText('Find your perfect fit with Footwear Next using our size conversion chart.')
        ).toBeInTheDocument();
    });

    it('calls onClose when the sheet is dismissed', async () => {
        const onClose = vi.fn();
        render(<SizeGuideDrawer isOpen sizeChart={mensChart} gender="mens" onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('passes highlightSize through to the conversion table', async () => {
        render(<SizeGuideDrawer isOpen sizeChart={mensChart} gender="mens" onClose={vi.fn()} highlightSize="9" />);
        const rowheader = await screen.findByRole('rowheader', { name: /^9/ });
        expect(rowheader.closest('tr')).toHaveAttribute('aria-current', 'true');
    });
});
