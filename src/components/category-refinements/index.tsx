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
import { type ReactElement, useCallback, useId, useMemo, useState } from 'react';
import { useLocation, useNavigation } from 'react-router';
import { useNavigate } from '@/hooks/use-navigate';

import type { ShopperSearch } from '@/scapi';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@/components/typography';
import { UITarget } from '@/targets/ui-target';
import { uiConfig } from '@/lib/config.ui';
import type { FilterValue, RefinementProps } from '@/components/category-refinements/types';
import RefineDefault from '@/components/category-refinements/refine-default';
import RefineColor from '@/components/category-refinements/refine-color';
import RefineSize from '@/components/category-refinements/refine-size';
import RefinePrice from '@/components/category-refinements/refine-price';
import RefineCategory from '@/components/category-refinements/refine-cgid';
// @sfdc-extension-line SFDC_EXT_BOPIS
import RefineInventory from '@/extensions/bopis/components/refine-inventory';
import RefineCushioning from './refine-cushioning';
import RefineSupport from './refine-support';
import RefineTerrain from './refine-terrain';

/**
 * Footwear overlay of the canonical `CategoryRefinements` orchestrator (`@/components/category-refinements`).
 *
 * Adds performance-attribute facets on top of the canonical dispatch: `c_cushioning`, `c_supportType`, and
 * `c_terrain` get dedicated overlay components that map technical values to shopper-facing labels, while
 * `c_heelDrop` reuses the canonical `RefineDefault` checkbox list directly — SCAPI returns its heel-to-toe
 * drop buckets (0-4, 5-8, 9-12+ mm) as predefined range values, the same mechanism as the system `price`
 * attribute, so no client-side transformation is needed. The `cgid` case is unchanged from canonical:
 * footwear's "Shop by Activity" facet is already served by the existing `cgid`→`RefineCategory` sidebar
 * mechanism (`uiConfig.pages.category.sidebarCategoryRefinement.enabled`, see `@/lib/config.ui`), not a new
 * component.
 */
export default function CategoryRefinements({
    result,
    refine = [],
}: {
    result: ShopperSearch.schemas['ProductSearchResult'];
    refine: string[];
}): ReactElement {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const navigation = useNavigation();
    const isPending = navigation.state !== 'idle';

    const effectiveRefines = navigation.location
        ? new URLSearchParams(navigation.location.search).getAll('refine')
        : refine;

    const hasActiveFilter = useCallback(
        (attributeId: string) => {
            return effectiveRefines.some((r) => r.startsWith(`${attributeId}=`));
        },
        [effectiveRefines]
    );

    const keepCgidInSidebar = uiConfig.pages.category.sidebarCategoryRefinement?.enabled ?? false;
    const refinements = useMemo(
        () =>
            (result?.refinements || []).filter((refinement) => keepCgidInSidebar || refinement.attributeId !== 'cgid'),
        [result, keepCgidInSidebar]
    );

    const toggleFilter = useCallback(
        (attributeId: string, value: string) => {
            const params = new URLSearchParams(location.search);
            const refines = params.getAll('refine');
            const refinePair = `${attributeId}=${value}`;

            let nextRefines: string[];
            if (refines.includes(refinePair)) {
                nextRefines = refines.filter((r) => r !== refinePair);
            } else {
                const exclusiveRefinements = ['price', 'cgid', /* @sfdc-extension-line SFDC_EXT_BOPIS */ 'ilids'];
                if (exclusiveRefinements.includes(attributeId)) {
                    nextRefines = [...refines.filter((r) => !r.startsWith(`${attributeId}=`)), refinePair];
                } else {
                    nextRefines = [...refines, refinePair];
                }
            }

            params.delete('refine');
            nextRefines.forEach((r) => params.append('refine', r));
            params.set('offset', '0');

            const nextSearch = `?${params.toString()}`;

            void navigate({
                pathname: location.pathname,
                search: nextSearch,
            });
        },
        [location, navigate]
    );

    const isFilterSelected = useCallback(
        (attributeId: string, value: string) => {
            return effectiveRefines.includes(`${attributeId}=${value}`);
        },
        [effectiveRefines]
    );

    const renderFilterValues = (
        refinement: ShopperSearch.schemas['ProductSearchRefinement'] & { values: FilterValue[] }
    ) => {
        const { attributeId, values } = refinement;
        const refinementProps: RefinementProps = {
            values,
            attributeId,
            isFilterSelected,
            toggleFilter,
        };

        switch (attributeId) {
            case 'c_refinementColor':
                return <RefineColor {...refinementProps} />;
            case 'c_size':
                return <RefineSize {...refinementProps} />;
            case 'price':
                return <RefinePrice {...refinementProps} result={result} />;
            case 'cgid':
                return <RefineCategory {...refinementProps} label={refinement.label} />;
            case 'c_cushioning':
                return <RefineCushioning {...refinementProps} />;
            case 'c_supportType':
                return <RefineSupport {...refinementProps} />;
            case 'c_terrain':
                return <RefineTerrain {...refinementProps} />;
            // Heel-drop buckets arrive from SCAPI as predefined range values, so the canonical
            // checkbox list renders them as-is — no dedicated component needed (see file docstring).
            case 'c_heelDrop':
                return <RefineDefault {...refinementProps} />;
            default:
                return <RefineDefault {...refinementProps} />;
        }
    };

    if (refinements.length === 0) {
        return (
            <div className="border p-4">
                <p className="text-muted-foreground text-sm">{t('categoryRefinements:noFilterOptionsAvailable')}</p>
            </div>
        );
    }

    return (
        <UITarget targetId="sfcc.plp.search.filters">
            <div className={isPending ? 'pointer-events-none opacity-50 transition-opacity' : ''}>
                {/*  @sfdc-extension-block-start SFDC_EXT_BOPIS */}
                <RefineInventory
                    isFilterSelected={isFilterSelected}
                    hasActiveFilter={hasActiveFilter}
                    toggleFilter={toggleFilter}
                />
                {/*  @sfdc-extension-block-end SFDC_EXT_BOPIS */}

                {refinements.map((refinement) => {
                    const { values, attributeId, label } = refinement;
                    if (!Array.isArray(values) || !values.length) {
                        return null;
                    }

                    return (
                        <FilterSection
                            key={attributeId}
                            label={label || attributeId}
                            defaultOpen={hasActiveFilter(attributeId)}>
                            {renderFilterValues(
                                refinement as ShopperSearch.schemas['ProductSearchRefinement'] & {
                                    values: FilterValue[];
                                }
                            )}
                        </FilterSection>
                    );
                })}
            </div>
        </UITarget>
    );
}

/**
 * Individual filter section with collapsible behavior.
 * Shows Plus icon when collapsed, Minus when expanded.
 */
function FilterSection({
    label,
    defaultOpen = false,
    children,
}: {
    label: string;
    defaultOpen?: boolean;
    children: ReactElement;
}): ReactElement {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const labelId = useId();

    return (
        <section>
            <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border border-border mb-4 rounded-ui">
                <Typography variant="small" as="h3" className="leading-normal p-4 transition-colors hover:bg-muted/60">
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-left px-1 py-1 -mx-1 cursor-pointer">
                        <Typography variant="small" as="span" id={labelId} className="font-medium">
                            {label}
                        </Typography>
                        {isOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}
                    </CollapsibleTrigger>
                </Typography>
                <CollapsibleContent className="px-4 pb-4">
                    <div role="group" aria-labelledby={labelId}>
                        {children}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </section>
    );
}
