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
 * Footwear Next per-page UI overrides:
 * - Opts the category (`cgid`) refinement into the side-panel filters as a single-select
 *   radio group (`category.sidebarCategoryRefinement.enabled`). Footwear surfaces the
 *   "activity" category level (Running / Trail / Training / …) as a "Shop by Activity"
 *   sidebar facet; the category route consequently suppresses the QuickFilters chip row
 *   so the same level isn't filterable in two UIs. Every other vertical leaves this off.
 *
 * Every other flag matches the canonical baseline, so cart, product, and category
 * pagination behaviour is unchanged from the default (mirrored verbatim below).
 */
interface UIConfig {
    pages: {
        cart: {
            showRecommendations: boolean;
            showLineItemVariantAttributes: boolean;
            showLineItemListPrice: boolean;
            showLineItemPromoBadge: boolean;
            showLineItemBonusBadge: boolean;
        };
        category: {
            showCategoryLabel: boolean;
            pagination: {
                mode: 'load-more' | 'traditional';
                batchSize: number;
                mobileBatchSize: number;
                maxProducts: number;
            };
            /** Opt-in: keep the `cgid` refinement in the sidebar as a single-select radio group. @default undefined */
            sidebarCategoryRefinement?: {
                enabled: boolean;
            };
        };
        product: {
            showRatingAverage: boolean;
            /** Variation-attribute ids rendered as a grouped/tabbed swatch selector. @default undefined */
            groupedSwatchAxes?: string[];
            /** Variation-attribute ids whose image swatches render as larger option cards. @default undefined */
            imageCardAxes?: string[];
            /** When true, wrap each PDP swatch section in a collapsible with a selected-value summary. @default false */
            collapsibleSwatchSections?: boolean;
            /** PDP product-image gallery layout: 'stacked' (hero + thumbnails) or 'mosaic'. @default 'stacked' */
            galleryLayout?: 'stacked' | 'mosaic';
        };
    };
}

export const uiConfig: UIConfig = {
    pages: {
        cart: {
            showRecommendations: true,
            showLineItemVariantAttributes: true,
            showLineItemListPrice: true,
            showLineItemPromoBadge: true,
            showLineItemBonusBadge: true,
        },
        category: {
            showCategoryLabel: false,
            pagination: {
                mode: 'load-more',
                batchSize: 24,
                mobileBatchSize: 12,
                maxProducts: 200,
            },
            sidebarCategoryRefinement: {
                enabled: true,
            },
        },
        product: {
            showRatingAverage: false,
        },
    },
};
