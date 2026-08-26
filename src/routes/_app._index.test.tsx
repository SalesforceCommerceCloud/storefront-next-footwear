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

/**
 * Footwear home route overlay test (Rule 5: a route overlay copies the canonical route's sibling
 * test). The footwear overlay renders static marketing content and uses additive Page Designer slots.
 * It reuses the shared <PopularCategories> with the `activity` parent's children, left-aligned with a
 * "View all activities" shop-all link (the canonical home uses the `root` categories, centered, with
 * no shop-all link).
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ShopperExperience, ShopperProducts, ShopperSearch } from '@/scapi';
import { getTranslation } from '@salesforce/storefront-next-runtime/i18n';
import HomePage, { HomePageMetadata, type HomePageData, loader } from './_app._index';
import { createTestContext } from '@/lib/test-utils';
import { fetchPageWithComponentData } from '@/lib/page-designer/page-loader.server';
import { fetchSearchProducts } from '@/lib/api/search.server';
import { fetchCategories } from '@/lib/api/categories.server';
import { getConfig } from '@salesforce/storefront-next-runtime/config';
import type { AppConfig } from '@/types/config';
import { getRegionDefinitions } from '@/lib/decorators/region-definition';

const { t } = getTranslation();

// Mock data
const mockSearchResult = {
    hits: [
        {
            productId: 'product-1',
            productName: 'Product 1',
            image: { alt: 'Product 1', link: '/product1.jpg' },
            price: 29.99,
            currency: 'USD',
            inventory: { ats: 10 },
            representedProduct: {
                id: 'product-1',
            },
        },
    ],
    total: 1,
    query: '',
    refinements: [],
    searchPhraseSuggestions: { suggestedTerms: [] },
    sortingOptions: [],
    start: 0,
    count: 1,
    offset: 0,
    limit: 10,
} as unknown as ShopperSearch.schemas['ProductSearchResult'];

const mockCategories: ShopperProducts.schemas['Category'][] = [
    {
        id: 'category-1',
        name: 'Category 1',
        parentCategoryId: 'root',
        image: '/category1.jpg',
    },
    {
        id: 'category-2',
        name: 'Category 2',
        parentCategoryId: 'root',
        image: '/category2.jpg',
    },
];

// Helper function to create mock Page objects
const createMockPage = (regions: any[] = []): ShopperExperience.schemas['Page'] =>
    ({
        id: 'mock-page',
        typeId: 'homepage',
        regions,
    }) as ShopperExperience.schemas['Page'];

// Region mock that mirrors the real component closely enough to prove composition: once the page
// resolves it renders the region's authored components (like the real Region does), so a test can
// tell additive slots apart from ones that replace the static sections. It still surfaces the
// fallback props so we can assert the overlay passes none.
vi.mock('@/components/region', async () => {
    const { Suspense } = await import('react');
    const { Await } = await import('react-router');
    const renderRegion = (regionId: string, errorElement: unknown, fallbackElement: unknown, critical: boolean) =>
        function ResolvedRegion(resolvedPage: any) {
            const components = resolvedPage?.regions?.find((region: any) => region.id === regionId)?.components ?? [];
            return (
                <div
                    data-testid={`region-${regionId}`}
                    data-has-error-element={String(errorElement !== undefined)}
                    data-has-fallback-element={String(fallbackElement !== undefined)}
                    data-critical={String(critical)}>
                    {components.map((component: any) => (
                        <div key={component.id} data-testid={`region-component-${component.id}`}>
                            {component.typeId}
                        </div>
                    ))}
                </div>
            );
        };
    return {
        Region: ({ page, regionId, errorElement, fallbackElement, critical = false }: any) =>
            page && typeof page.then === 'function' ? (
                <Suspense fallback={<div data-testid={`region-${regionId}-pending`} />}>
                    <Await resolve={page}>{renderRegion(regionId, errorElement, fallbackElement, critical)}</Await>
                </Suspense>
            ) : (
                renderRegion(regionId, errorElement, fallbackElement, critical)(page)
            ),
    };
});

// Mock the shared PopularCategories component. Surface the activity-specific inputs (heading alignment
// + shop-all link) so the overlay's wiring is assertable without pulling in the real carousel.
vi.mock('@/components/home/popular-categories', () => ({
    default: ({ titleAlign, title, shopAllText, shopAllUrl }: any) => (
        <div data-testid="popular-categories" data-title-align={titleAlign}>
            {title && <h2>{title}</h2>}
            {shopAllText && <a href={shopAllUrl}>{shopAllText}</a>}
        </div>
    ),
}));

// Mock the ContentCard component
vi.mock('@/components/content-card', () => ({
    default: ({ title, description }: any) => (
        <div data-testid="content-card">
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    ),
}));

// Mock HeroCarousel component
vi.mock('@/components/hero-carousel', () => ({
    default: () => <div data-testid="hero-carousel">Hero Carousel</div>,
}));

// Mock ProductCarousel components
vi.mock('@/components/product-carousel', () => ({
    ProductCarouselSkeleton: () => <div data-testid="product-carousel-skeleton">Product Carousel</div>,
}));

vi.mock('@/components/product-carousel/carousel', () => ({
    ProductCarouselWithData: ({ data, title }: any) => (
        <div data-testid="product-carousel">
            {title && <h2>{title}</h2>}
            {data?.hits?.length ?? 0} products
        </div>
    ),
}));

// Mock the Button component
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

// Mock the Skeleton component
vi.mock('@/components/ui/skeleton', () => ({
    Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton" className={className} {...props} />,
}));

// Mock react-i18next with partial mock to preserve other exports
vi.mock('react-i18next', async () => {
    const actual: any = await vi.importActual('react-i18next');
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => {
                const normalizedKey = key.startsWith('home:') ? key.substring(5) : key;
                const translations: Record<string, string> = {
                    'hero.slide1.title': 'Welcome to Our Store',
                    'hero.slide1.subtitle': 'Discover amazing products',
                    'hero.slide1.imageAlt': 'Hero image',
                    'hero.slide1.ctaText': 'Shop Now',
                    'hero.slide2.title': 'Summer Collection',
                    'hero.slide2.subtitle': 'Hot deals on trending items',
                    'hero.slide2.ctaText': 'Explore',
                    'hero.slide3.title': 'Free Shipping',
                    'hero.slide3.subtitle': 'On orders over $50',
                    'hero.slide3.ctaText': 'Learn More',
                    'featuredProducts.title': 'Featured Products',
                    'activityDiscovery.title': 'Shop by Activity',
                    'activityDiscovery.subtitle': 'Find the right shoe for how you move',
                    'activityDiscovery.viewAll': 'View all activities',
                    'featuredContent.women.title': 'Women',
                    'featuredContent.women.description':
                        'Discover our curated collection of sophisticated footwear designed for the modern woman.',
                    'featuredContent.women.imageAlt': "Women's Collection",
                    'featuredContent.women.ctaText': 'EXPLORE COLLECTION',
                    'featuredContent.men.title': 'Men',
                    'featuredContent.men.description':
                        "Timeless craftsmanship meets contemporary style in our men's footwear collection.",
                    'featuredContent.men.imageAlt': "Men's Collection",
                    'featuredContent.men.ctaText': 'EXPLORE COLLECTION',
                    'featuredContent.styleForRealLife.title': 'Style for Real Life',
                    'featuredContent.styleForRealLife.description':
                        'We believe style should be effortless, authentic, and accessible.',
                };
                return translations[normalizedKey] || key;
            },
            i18n: {
                language: 'en-US',
                changeLanguage: vi.fn(),
            },
        }),
    };
});

// Mock decorators and utilities
vi.mock('@/lib/decorators/page-type', () => ({
    PageType: () => (target: any) => target,
}));

vi.mock('@/lib/page-designer/page-loader.server', () => ({
    fetchPageWithComponentData: vi.fn(),
}));

vi.mock('@/lib/api/search.server', () => ({
    fetchSearchProducts: vi.fn(() => Promise.resolve(mockSearchResult)),
}));

vi.mock('@/lib/api/categories.server', () => ({
    fetchCategories: vi.fn(() => Promise.resolve(mockCategories)),
}));

vi.mock('@salesforce/storefront-next-runtime/config', async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
        ...actual,
        getConfig: vi.fn(),
    };
});

vi.mock('@/lib/logger.server', () => ({
    getLogger: vi.fn(() => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    })),
}));

vi.mock('@/middlewares/auth.server', () => ({
    getAuth: vi.fn(() => ({ customerId: null })),
}));

const renderComponent = (loaderDataOverrides?: Partial<HomePageData>) => {
    const defaultData: HomePageData = {
        page: {
            ...createMockPage([]),
            componentData: {},
        },
        searchResult: Promise.resolve(mockSearchResult),
        categories: Promise.resolve(mockCategories),

        pageUrl: 'http://localhost/',
        ogImageUrl: 'http://localhost/__ASSET_MOCK__',
    };
    const data = { ...defaultData, ...loaderDataOverrides };
    return render(<HomePage loaderData={data} />);
};

describe('Footwear HomePage overlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(fetchPageWithComponentData).mockResolvedValue({
            ...createMockPage([]),
            componentData: {},
        });
        vi.mocked(getConfig).mockReturnValue({ pages: { home: { featuredProductsCount: 8 } } } as AppConfig);
    });

    describe('Basic Rendering', () => {
        test('renders featured content cards', () => {
            renderComponent();
            expect(screen.getByText(t('home:featuredContent.women.title'))).toBeInTheDocument();
            expect(screen.getByText(t('home:featuredContent.men.title'))).toBeInTheDocument();
        });

        test('renders the activity rail as static content', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByTestId('popular-categories')).toBeInTheDocument();
            });
        });

        test('feeds PopularCategories the activity heading + a left-aligned "View all activities" link', () => {
            renderComponent();
            const rail = screen.getByTestId('popular-categories');
            // Left-aligned so the shop-all link renders (center mode would drop it).
            expect(rail).toHaveAttribute('data-title-align', 'left');
            expect(screen.getByRole('heading', { name: 'Shop by Activity' })).toBeInTheDocument();
            const viewAll = screen.getByRole('link', { name: 'View all activities' });
            // Links to the activity landing PLP (the parent category of the activity children).
            expect(viewAll).toHaveAttribute('href', expect.stringContaining('/category/activity'));
        });

        test('stacks authored Page Designer content on top of the static marketing sections', async () => {
            renderComponent({
                page: {
                    ...createMockPage([
                        { id: 'headerbanner', components: [{ id: 'top-slot', typeId: 'hero' }] },
                        { id: 'main', components: [{ id: 'main-slot', typeId: 'banner' }] },
                    ]),
                    componentData: {},
                },
            });

            // Authored components render inside their slots...
            expect(await screen.findByTestId('region-component-top-slot')).toBeInTheDocument();
            expect(screen.getByTestId('region-component-main-slot')).toBeInTheDocument();
            // ...and the static sections still render alongside them, rather than being replaced.
            expect(screen.getByTestId('hero-carousel')).toBeInTheDocument();
            expect(screen.getByTestId('popular-categories')).toBeInTheDocument();
            expect(screen.getByText(t('home:featuredContent.women.title'))).toBeInTheDocument();
            expect(await screen.findByTestId('product-carousel')).toBeInTheDocument();
        });

        test('does not pass fallbacks to Page Designer regions', async () => {
            renderComponent();

            for (const regionId of ['headerbanner', 'main']) {
                const region = await screen.findByTestId(`region-${regionId}`);
                expect(region).toHaveAttribute('data-has-error-element', 'false');
                expect(region).toHaveAttribute('data-has-fallback-element', 'false');
            }
        });

        test('marks only the above-the-fold header region as critical', async () => {
            renderComponent();

            expect(await screen.findByTestId('region-headerbanner')).toHaveAttribute('data-critical', 'true');
            expect(screen.getByTestId('region-main')).toHaveAttribute('data-critical', 'false');
        });
    });

    describe('Featured Content Cards Section', () => {
        test('renders all content cards with correct count', () => {
            renderComponent();
            const contentCards = screen.getAllByTestId('content-card');
            expect(contentCards).toHaveLength(3); // Women, Men, and Style for Real Life card
        });
    });

    describe('Page Designer metadata', () => {
        test('retains the deployed Page Designer region contract', () => {
            expect(getRegionDefinitions(HomePageMetadata)).toEqual([
                {
                    id: 'headerbanner',
                    name: 'Header Banner Region',
                    description: 'Region for promotional banners and hero content',
                    maxComponents: 3,
                },
                {
                    id: 'main',
                    name: 'Main Content Region',
                    description: 'Region for main content',
                    maxComponents: 10,
                },
            ]);
        });
    });

    describe('Loaders', () => {
        let mockContext: ReturnType<typeof createTestContext>;
        // The footwear routes carry URL-prefix typegen, so the loader's generated arg type requires
        // `params: { siteId, localeId }`. Use the loader's own parameter type rather than the bare
        // `LoaderFunctionArgs` so the test matches the generated signature.
        let baseLoaderArgs: Parameters<typeof loader>[0];

        beforeEach(() => {
            mockContext = createTestContext();
            baseLoaderArgs = {
                request: new Request('http://localhost/'),
                url: new URL('http://localhost/'),
                params: { siteId: 'global', localeId: 'en-GB' },
                context: mockContext,
                pattern: '/',
            } as Parameters<typeof loader>[0];
        });

        test('starts independent data requests before the critical page resolves', async () => {
            let resolvePage!: (page: ShopperExperience.schemas['Page']) => void;
            vi.mocked(fetchPageWithComponentData).mockReturnValue(
                new Promise((resolve) => {
                    resolvePage = resolve;
                })
            );

            const result = loader(baseLoaderArgs);

            expect(fetchSearchProducts).toHaveBeenCalled();
            expect(fetchCategories).toHaveBeenCalled();

            resolvePage(createMockPage([]));
            await result;
        });

        test('awaits home page data with fetchPageWithComponentData', async () => {
            const mockPageWithData = {
                ...createMockPage([]),
                componentData: { test: Promise.resolve('data') },
            };
            const pagePromise = Promise.resolve(mockPageWithData);

            vi.mocked(fetchPageWithComponentData).mockReturnValue(pagePromise);

            const result = await loader(baseLoaderArgs);

            expect(vi.mocked(fetchPageWithComponentData)).toHaveBeenCalledWith(baseLoaderArgs, {
                pageId: 'homepage',
            });
            expect(result.page).toBe(mockPageWithData);
            expect(result.searchResult).toBeInstanceOf(Promise);
            expect(result.categories).toBeInstanceOf(Promise);
        });

        test('fetches the children of the `activity` parent category for the rail', async () => {
            await loader(baseLoaderArgs);
            expect(vi.mocked(fetchCategories)).toHaveBeenCalledWith(mockContext, 'activity', 1);
        });

        test('loader propagates page API errors', async () => {
            const error = new Error('API Error');
            vi.mocked(fetchPageWithComponentData).mockRejectedValue(error);

            await expect(loader(baseLoaderArgs)).rejects.toThrow('API Error');
        });

        test('observes deferred request failures when the page request rejects', async () => {
            const pageError = new Error('Page failed');
            const searchPromise = Promise.reject(new Error('Search failed'));
            const categoriesPromise = Promise.reject(new Error('Categories failed'));
            const allSettledSpy = vi.spyOn(Promise, 'allSettled');

            vi.mocked(fetchPageWithComponentData).mockRejectedValueOnce(pageError);
            vi.mocked(fetchSearchProducts).mockReturnValueOnce(searchPromise);
            vi.mocked(fetchCategories).mockReturnValueOnce(categoriesPromise);

            try {
                await expect(loader(baseLoaderArgs)).rejects.toBe(pageError);
                expect(allSettledSpy).toHaveBeenCalledWith([searchPromise, categoriesPromise]);
            } finally {
                allSettledSpy.mockRestore();
            }
        });
    });

    describe('shouldRevalidate export', () => {
        test('re-exports the home page revalidation policy', async () => {
            const { shouldRevalidate } = await import('./_app._index');
            const { shouldRevalidate: shouldRevalidateHome } = await import('@/lib/revalidation/routes/home');
            expect(shouldRevalidate).toBe(shouldRevalidateHome);
        });
    });
});
