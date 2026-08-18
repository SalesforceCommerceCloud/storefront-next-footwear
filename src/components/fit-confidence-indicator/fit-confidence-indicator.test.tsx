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
import { FitConfidenceIndicator } from './fit-confidence-indicator';
import type { FitFeedback } from './fit-feedback-data';

// Footwear-vertical strings aren't in the canonical resources vitest.setup.ts initializes
// (VERTICAL isn't set for `pnpm test`), so mock react-i18next directly, mirroring the
// established pattern in this vertical's home route test.
vi.mock('react-i18next', async () => {
    const actual: any = await vi.importActual('react-i18next');
    const translations: Record<string, string> = {
        'sizeGuide.fitConfidence.summary': '{{percent}}% of {{count}} reviewers say this fits true to size',
        'sizeGuide.fitConfidence.trueToSize': 'True to size',
        'sizeGuide.fitConfidence.runsSmall': 'Runs small',
        'sizeGuide.fitConfidence.runsLarge': 'Runs large',
    };
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: Record<string, string | number>) => {
                const value = translations[key] ?? key;
                if (options) {
                    return value.replace(/\{\{(\w+)\}\}/g, (_match, prop) => String(options[prop] ?? `{{${prop}}}`));
                }
                return value;
            },
            i18n: { language: 'en-US', changeLanguage: vi.fn() },
        }),
    };
});

const feedback: FitFeedback = {
    totalResponses: 120,
    runsSmallPercent: 20,
    trueToSizePercent: 65,
    runsLargePercent: 15,
};

describe('FitConfidenceIndicator', () => {
    it('renders nothing when feedback is null', () => {
        const { container } = render(<FitConfidenceIndicator feedback={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders a loading skeleton when loading is true, even with feedback present', () => {
        const { container } = render(<FitConfidenceIndicator feedback={feedback} loading />);
        expect(screen.queryByRole('meter')).not.toBeInTheDocument();
        expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    });

    it('renders a meter reflecting the true-to-size percentage', () => {
        render(<FitConfidenceIndicator feedback={feedback} />);
        const meter = screen.getByRole('meter');
        expect(meter).toHaveAttribute('aria-valuenow', '65');
        expect(meter).toHaveAttribute('aria-valuemin', '0');
        expect(meter).toHaveAttribute('aria-valuemax', '100');
    });

    it('renders the summary sentence with the rounded percent and response count', () => {
        render(<FitConfidenceIndicator feedback={feedback} />);
        expect(screen.getByText('65% of 120 reviewers say this fits true to size')).toBeInTheDocument();
    });

    it('rounds a fractional true-to-size percent in the summary and meter', () => {
        render(
            <FitConfidenceIndicator
                feedback={{ totalResponses: 10, runsSmallPercent: 20, trueToSizePercent: 65.6, runsLargePercent: 14.4 }}
            />
        );
        expect(screen.getByText(/^66% of 10 reviewers/)).toBeInTheDocument();
        expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '66');
    });

    it('bolds only the dominant segment label when one segment strictly leads', () => {
        render(<FitConfidenceIndicator feedback={feedback} />);
        expect(screen.getByText('True to size')).toHaveClass('font-semibold', 'text-foreground');
        expect(screen.getByText('Runs small')).not.toHaveClass('font-semibold');
        expect(screen.getByText('Runs large')).not.toHaveClass('font-semibold');
    });

    it('bolds every tied segment label when two segments share the max', () => {
        render(
            <FitConfidenceIndicator
                feedback={{ totalResponses: 30, runsSmallPercent: 40, trueToSizePercent: 40, runsLargePercent: 20 }}
            />
        );
        expect(screen.getByText('Runs small')).toHaveClass('font-semibold');
        expect(screen.getByText('True to size')).toHaveClass('font-semibold');
        expect(screen.getByText('Runs large')).not.toHaveClass('font-semibold');
    });
});
