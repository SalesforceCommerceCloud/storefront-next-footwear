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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ShopperExperience } from '@/scapi';
import type { Route } from './+types/_app.about-us';
import AboutUs, { AboutUsPageMetadata, type AboutUsPageData, loader } from './_app.about-us';
import { createTestContext } from '@/lib/test-utils';
import { fetchPageWithComponentData } from '@/lib/page-designer/page-loader.server';
import { getRegionDefinitions } from '@/lib/decorators/region-definition';

const createMockPage = (regions: unknown[] = []): ShopperExperience.schemas['Page'] =>
    ({
        id: 'mock-page',
        typeId: 'aboutus',
        regions,
    }) as ShopperExperience.schemas['Page'];

// Region mock that mirrors the real component closely enough to prove composition: once the page
// resolves it renders the region's authored components (like the real Region does), so a test can
// tell additive slots apart from ones that replace the static sections. It still surfaces the
// fallback props so we can assert the overlay passes none.
vi.mock('@/components/region', async () => {
    const { Suspense } = await import('react');
    const { Await } = await import('react-router');
    const renderRegion = (regionId: string, errorElement: unknown, fallbackElement: unknown) =>
        function ResolvedRegion(resolvedPage: any) {
            const components = resolvedPage?.regions?.find((region: any) => region.id === regionId)?.components ?? [];
            return (
                <div
                    data-testid={`region-${regionId}`}
                    data-has-error-element={String(errorElement !== undefined)}
                    data-has-fallback-element={String(fallbackElement !== undefined)}>
                    {components.map((component: any) => (
                        <div key={component.id} data-testid={`region-component-${component.id}`}>
                            {component.typeId}
                        </div>
                    ))}
                </div>
            );
        };
    return {
        Region: ({ page, regionId, errorElement, fallbackElement }: any) =>
            page && typeof page.then === 'function' ? (
                <Suspense fallback={<div data-testid={`region-${regionId}-pending`} />}>
                    <Await resolve={page}>{renderRegion(regionId, errorElement, fallbackElement)}</Await>
                </Suspense>
            ) : (
                renderRegion(regionId, errorElement, fallbackElement)(page)
            ),
    };
});

vi.mock('@/components/link', () => ({
    Link: ({ to, children }: any) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/contact', () => ({
    default: () => <div data-testid="contact">Contact Form</div>,
}));

vi.mock('@/components/content-card', () => ({
    default: ({ title, description }: any) => (
        <div data-testid="content-card">
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    ),
}));

vi.mock('react-i18next', async () => {
    const actual: any = await vi.importActual('react-i18next');
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => {
                const translations: Record<string, string> = {
                    title: 'About Us',
                    'meta.description': 'Learn more about our story, mission, and the team behind the store.',
                    'breadcrumb.home': 'Home',
                    'breadcrumb.aboutUs': 'About Us',
                    'section.ourGoal.title': 'Built for movement. Designed for everyday life.',
                    'section.ourGoal.content': 'Inspired by urban culture and the energy of movement.',
                    'section.ourVision.title': 'Our Vision',
                    'section.ourVision.content':
                        'To redefine modern retail through technology, design, and customer experience.',
                    'section.ourVision.imageAlt': 'Our vision',
                    'section.ourValue.title': 'Why We Exist',
                    'section.ourValue.content': 'We exist to remove friction between people and what they love.',
                    'section.ourValue.imageAlt': 'Our values',
                    'section.ourMission.title': 'What We Stand For',
                    'section.ourMission.content':
                        'Design with purpose: every product, every interaction, every detail is intentional.',
                    'section.ourMission.cta': 'Explore',
                    'section.ourTeam.title': 'A Global Brand, A Street-Level Soul',
                    'section.ourTeam.content':
                        'Market Street was born from the idea that great style should not feel unreachable.',
                    'section.ourTeam.imageAlt': 'Our team',
                    'section.ourTeam.cta': 'Explore',
                };
                return translations[key] ?? key;
            },
        }),
    };
});

vi.mock('@/lib/page-designer/page-loader.server', () => ({
    fetchPageWithComponentData: vi.fn(),
}));

vi.mock('@/lib/logger.server', () => ({
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
    })),
}));

const renderComponent = (loaderDataOverrides?: Partial<AboutUsPageData>) => {
    const defaultData: AboutUsPageData = {
        page: Promise.resolve({
            ...createMockPage([]),
            componentData: {},
        }),
        pageUrl: 'http://localhost/about-us',
        ogImageUrl: 'http://localhost/__ASSET_MOCK__',
    };
    return render(<AboutUs loaderData={{ ...defaultData, ...loaderDataOverrides }} />);
};

describe('Footwear AboutUs overlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchPageWithComponentData).mockResolvedValue({
            ...createMockPage([]),
            componentData: {},
        });
    });

    test('renders every static marketing card and the contact section', () => {
        renderComponent();

        expect(screen.getByText('Built for movement. Designed for everyday life.')).toBeInTheDocument();
        expect(screen.getByText('Our Vision')).toBeInTheDocument();
        expect(screen.getByText('Why We Exist')).toBeInTheDocument();
        expect(screen.getByText('What We Stand For')).toBeInTheDocument();
        expect(screen.getByText('A Global Brand, A Street-Level Soul')).toBeInTheDocument();
        expect(screen.getByTestId('contact')).toBeInTheDocument();
        expect(screen.getAllByTestId('content-card')).toHaveLength(5);
    });

    test('renders the page title as the document-level H1', () => {
        renderComponent();

        expect(screen.getByRole('heading', { level: 1, name: 'About Us' })).toBeInTheDocument();
    });

    test('stacks authored Page Designer content on top of the static marketing sections', async () => {
        renderComponent({
            page: Promise.resolve({
                ...createMockPage([
                    { id: 'headline', components: [{ id: 'top-slot', typeId: 'hero' }] },
                    { id: 'additionalinformation', components: [{ id: 'bottom-slot', typeId: 'grid' }] },
                ]),
                componentData: {},
            }),
        });

        // Authored components render inside their slots...
        expect(await screen.findByTestId('region-component-top-slot')).toBeInTheDocument();
        expect(screen.getByTestId('region-component-bottom-slot')).toBeInTheDocument();
        // ...and the static sections still render alongside them, rather than being replaced.
        expect(screen.getByText('Built for movement. Designed for everyday life.')).toBeInTheDocument();
        expect(screen.getByText('What We Stand For')).toBeInTheDocument();
        expect(screen.getByTestId('contact')).toBeInTheDocument();
    });

    test('does not pass fallbacks to Page Designer regions', async () => {
        renderComponent();

        for (const regionId of ['headline', 'additionalinformation']) {
            const region = await screen.findByTestId(`region-${regionId}`);
            expect(region).toHaveAttribute('data-has-error-element', 'false');
            expect(region).toHaveAttribute('data-has-fallback-element', 'false');
        }
    });

    test('retains the deployed Page Designer region contract', () => {
        expect(getRegionDefinitions(AboutUsPageMetadata)).toEqual([
            {
                id: 'headline',
                name: 'Headline Region',
                description: 'Main content area displayed above the contact form',
                maxComponents: 10,
            },
            {
                id: 'additionalinformation',
                name: 'Additional Information Region',
                description: 'Secondary content area displayed below the contact form',
                maxComponents: 10,
            },
        ]);
    });

    test('starts loading the About Us Page Designer page without delaying static content', () => {
        const args = {
            request: new Request('http://localhost/about-us'),
            url: new URL('http://localhost/about-us'),
            params: { siteId: 'global', localeId: 'en-GB' },
            context: createTestContext(),
            pattern: '/about-us',
        } as Route.LoaderArgs;

        const result = loader(args);

        expect(vi.mocked(fetchPageWithComponentData)).toHaveBeenCalledWith(args, { pageId: 'aboutus' });
        expect(result.page).toBe(vi.mocked(fetchPageWithComponentData).mock.results[0]?.value);
        expect(result.pageUrl).toBe('http://localhost/about-us');
    });
});
