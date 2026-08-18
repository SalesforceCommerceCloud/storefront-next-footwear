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
import type { Route } from './+types/_app.size-guide';
import { Link } from '@/components/link';
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Typography } from '@/components/typography';
import { SeoMeta } from '@/components/seo-meta';
import { buildCanonicalUrl } from '@/utils/canonical-url';
import { SizeGuideContent, DEFAULT_SIZE_CHARTS } from '@/components/size-guide-drawer';

export type SizeGuidePageData = {
    pageUrl: string;
};

/**
 * Standalone, SEO-crawlable `/size-guide` route for the footwear vertical (net new — no
 * canonical counterpart). Renders the same conversion content as the PDP `SizeGuideDrawer`
 * (via the shared <SizeGuideContent>) so search engines and shoppers arriving without a
 * product context still get the full US/UK/EU/CM (+JP) chart and "How to Measure" guidance.
 * Defaults to the mens chart with no product-specific `c_sizeChart`/highlighted size, since
 * this page has no product/category context to derive those from.
 */
export async function loader({ request }: Route.LoaderArgs): Promise<SizeGuidePageData> {
    const requestUrl = new URL(request.url);
    return {
        pageUrl: buildCanonicalUrl(requestUrl.origin, requestUrl.pathname, requestUrl.search),
    };
}

export function ErrorBoundary(): ReactElement {
    const { t } = useTranslation('product');
    return <p className="mx-auto max-w-screen-2xl px-4 py-8">{t('sizeGuide.description')}</p>;
}

export default function SizeGuidePage({ loaderData }: { loaderData: SizeGuidePageData }): ReactElement {
    const { t } = useTranslation('product');

    return (
        <div className="max-w-screen-2xl mx-auto px-4 pb-8">
            <SeoMeta
                title={t('sizeGuide.title')}
                description={t('sizeGuide.metaDescription', { defaultValue: t('sizeGuide.description') })}
                openGraph={{ type: 'website', url: loaderData.pageUrl }}
            />

            <Breadcrumb className="mb-2.5 pt-4">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link to="/">{t('sizeGuide.breadcrumb.home')}</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{t('sizeGuide.breadcrumb.sizeGuide')}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <Typography variant="h2" className="mb-1">
                {t('sizeGuide.title')}
            </Typography>
            <p className="mb-6 text-sm text-muted-foreground">{t('sizeGuide.description')}</p>

            <div className="max-w-xl">
                <SizeGuideContent sizeChart={DEFAULT_SIZE_CHARTS.mens} gender="mens" />
            </div>
        </div>
    );
}
