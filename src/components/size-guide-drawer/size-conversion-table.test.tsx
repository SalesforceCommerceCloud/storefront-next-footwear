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
import { describe, it, expect, vi } from 'vitest';
import { SizeConversionTable } from './size-conversion-table';
import type { SizeChartEntry } from './size-chart-data';

// Footwear-vertical strings aren't in the canonical resources vitest.setup.ts initializes
// (VERTICAL isn't set for `pnpm test`), so mock react-i18next directly, mirroring the
// established pattern in this vertical's home route test.
vi.mock('react-i18next', async () => {
    const actual: any = await vi.importActual('react-i18next');
    const translations: Record<string, string> = {
        'sizeGuide.conversionTableCaption': '{{gender}} size conversion chart: US, UK, EU, and CM sizes',
        'sizeGuide.gender.mens': "Men's",
        'sizeGuide.gender.womens': "Women's",
        'sizeGuide.gender.kids': 'Kids',
        'sizeGuide.us': 'US',
        'sizeGuide.uk': 'UK',
        'sizeGuide.eu': 'EU',
        'sizeGuide.cm': 'CM',
        'sizeGuide.jp': 'JP',
        'sizeGuide.yourSize': '(your size)',
    };
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: Record<string, string>) => {
                const normalizedKey = key.startsWith('product:') ? key.substring(8) : key;
                const value = translations[normalizedKey] ?? normalizedKey;
                if (options) {
                    return value.replace(/\{\{(\w+)\}\}/g, (_match, prop) => options[prop] ?? `{{${prop}}}`);
                }
                return value;
            },
            i18n: { language: 'en-US', changeLanguage: vi.fn() },
        }),
    };
});

const mensEntries: SizeChartEntry[] = [
    { us: '9', uk: '8', eu: '42.5', cm: '27' },
    { us: '9.5', uk: '8.5', eu: '43', cm: '27.5' },
];

const entriesWithJp: SizeChartEntry[] = [
    { us: '9', uk: '8', eu: '42.5', cm: '27', jp: '27' },
    { us: '9.5', uk: '8.5', eu: '43', cm: '27.5', jp: '27.5' },
];

describe('SizeConversionTable', () => {
    it('renders a header column for each of US, UK, EU, CM', () => {
        render(<SizeConversionTable entries={mensEntries} gender="mens" />);
        expect(screen.getByRole('columnheader', { name: 'US' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'UK' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'EU' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'CM' })).toBeInTheDocument();
    });

    it('does not render a JP column when no entry has a jp value', () => {
        render(<SizeConversionTable entries={mensEntries} gender="mens" />);
        expect(screen.queryByRole('columnheader', { name: 'JP' })).not.toBeInTheDocument();
    });

    it('renders a JP column when at least one entry has a jp value', () => {
        render(<SizeConversionTable entries={entriesWithJp} gender="mens" />);
        expect(screen.getByRole('columnheader', { name: 'JP' })).toBeInTheDocument();
        expect(screen.getAllByText('27')).toHaveLength(2); // cm and jp both read "27" for this entry
    });

    it('renders every row of the provided entries', () => {
        render(<SizeConversionTable entries={mensEntries} gender="mens" />);
        expect(screen.getByRole('rowheader', { name: '9' })).toBeInTheDocument();
        expect(screen.getByRole('rowheader', { name: '9.5' })).toBeInTheDocument();
    });

    it('highlights the row matching highlightSize', () => {
        render(<SizeConversionTable entries={mensEntries} gender="mens" highlightSize="9.5" />);
        const highlightedRow = screen.getByRole('rowheader', { name: /9.5/ }).closest('tr');
        expect(highlightedRow).toHaveAttribute('aria-current', 'true');
        expect(highlightedRow).toHaveClass('bg-accent');
    });

    it('does not highlight any row when highlightSize does not match an entry', () => {
        render(<SizeConversionTable entries={mensEntries} gender="mens" highlightSize="99" />);
        expect(screen.queryByRole('row', { name: /true/ })).not.toBeInTheDocument();
        for (const row of screen.getAllByRole('row')) {
            expect(row).not.toHaveAttribute('aria-current', 'true');
        }
    });

    it('applies a positive brandOffset to the EU column only', () => {
        render(<SizeConversionTable entries={mensEntries} gender="mens" brandOffset={1} />);
        expect(screen.getByText('43.5')).toBeInTheDocument();
        expect(screen.getByText('44')).toBeInTheDocument();
        // US/UK/CM are untouched by the offset
        expect(screen.getByRole('rowheader', { name: '9' })).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('27')).toBeInTheDocument();
    });

    it('leaves the EU column untouched when brandOffset is 0 (default)', () => {
        render(<SizeConversionTable entries={mensEntries} gender="mens" />);
        expect(screen.getByText('42.5')).toBeInTheDocument();
    });

    it('renders a caption naming the gender for screen readers', () => {
        render(<SizeConversionTable entries={mensEntries} gender="womens" />);
        expect(screen.getByText(/Women's size conversion chart/)).toBeInTheDocument();
    });
});
