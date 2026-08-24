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
import { SeoMeta } from '@/components/seo-meta';
import type { ShoeFinderConfig } from '@/components/shoe-finder/types';

// Phase 2 mounts its quiz engine here and supplies a ShoeFinderConfig. This route deliberately
// remains data-free so the navigation contract can ship ahead of the recommendation experience.
export type ShoeFinderExtensionPoint = (config: ShoeFinderConfig) => ReactElement;

export default function FindYourShoePage(): ReactElement {
    const { t } = useTranslation('product');

    return (
        <div className="section-container py-16" data-slot="find-your-shoe">
            <SeoMeta
                title={t('shoeFinder.title', { defaultValue: 'Find Your Shoe' })}
                description={t('shoeFinder.description', { defaultValue: 'Find the shoe built for how you move.' })}
            />
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {t('shoeFinder.title', { defaultValue: 'Find Your Shoe' })}
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
                {t('shoeFinder.comingSoon', {
                    defaultValue:
                        'Our personalized shoe finder is coming soon. Check back for help finding the right fit and activity.',
                })}
            </p>
        </div>
    );
}
