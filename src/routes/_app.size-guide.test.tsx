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
import { describe, test, expect, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import SizeGuidePage, { loader, ErrorBoundary, type SizeGuidePageData } from './_app.size-guide';
import { AllProvidersWrapper } from '@/test-utils/context-provider';

// Footwear-vertical strings aren't in the canonical resources vitest.setup.ts initializes
// (VERTICAL isn't set for `pnpm test`), so mock react-i18next directly, mirroring the
// established pattern in this vertical's home route and size-guide component tests.
// SizeGuideContent is rendered directly (not mocked), so its keys are included too.
vi.mock('react-i18next', async () => {
    const actual: any = await vi.importActual('react-i18next');
    const translations: Record<string, string> = {
        'sizeGuide.title': 'Size guide',
        'sizeGuide.description': 'Find your perfect fit using our size conversion chart.',
        'sizeGuide.breadcrumb.home': 'Home',
        'sizeGuide.breadcrumb.sizeGuide': 'Size Guide',
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
                const normalizedKey = key.startsWith('product:') ? key.substring(8) : key;
                const value = translations[normalizedKey] ?? normalizedKey;
                if (options && !('defaultValue' in options)) {
                    return value.replace(/\{\{(\w+)\}\}/g, (_match, prop) => options[prop] ?? `{{${prop}}}`);
                }
                if (options && 'defaultValue' in options && !(normalizedKey in translations)) {
                    return options.defaultValue as unknown as string;
                }
                return value;
            },
            i18n: { language: 'en-US', changeLanguage: vi.fn() },
        }),
    };
});

const renderPage = (data: SizeGuidePageData) => {
    const router = createMemoryRouter(
        [
            {
                path: '/size-guide',
                element: (
                    <AllProvidersWrapper>
                        <SizeGuidePage loaderData={data} />
                    </AllProvidersWrapper>
                ),
            },
            { path: '*', element: <div>Navigated</div> },
        ],
        { initialEntries: ['/size-guide'] }
    );
    return render(<RouterProvider router={router} />);
};

describe('Footwear SizeGuidePage', () => {
    describe('Loaders', () => {
        test('returns a canonical pageUrl derived from the request', () => {
            const result = loader({
                request: new Request('http://localhost/size-guide?foo=bar'),
            } as Parameters<typeof loader>[0]);

            expect(result).toEqual({ pageUrl: 'http://localhost/size-guide' });
        });
    });

    describe('Basic Rendering', () => {
        test('renders the title and description', () => {
            renderPage({ pageUrl: 'http://localhost/size-guide' });
            expect(screen.getByRole('heading', { name: 'Size guide' })).toBeInTheDocument();
            expect(screen.getByText('Find your perfect fit using our size conversion chart.')).toBeInTheDocument();
        });

        test('renders a breadcrumb with a Home link and the current Size Guide page', () => {
            renderPage({ pageUrl: 'http://localhost/size-guide' });
            expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', expect.stringContaining('/'));
            expect(screen.getByText('Size Guide')).toBeInTheDocument();
        });

        test('renders the default mens size chart content', () => {
            renderPage({ pageUrl: 'http://localhost/size-guide' });
            expect(screen.getByRole('tab', { name: 'Size chart' })).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByRole('button', { name: "Men's" })).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByRole('columnheader', { name: 'US' })).toBeInTheDocument();
        });
    });

    describe('ErrorBoundary', () => {
        test('renders the size guide description as a fallback', () => {
            render(<ErrorBoundary />);
            expect(screen.getByText('Find your perfect fit using our size conversion chart.')).toBeInTheDocument();
        });
    });
});
