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
import type { LoaderFunctionArgs } from 'react-router';
import type { ShopperProducts, ShopperSearch } from '@/scapi';
import type { Recommendation } from '@/hooks/recommenders/use-recommenders';
import { fetchCarouselProducts } from '@/components/product-carousel/loaders';
import { siteContext, type SiteContext } from '@salesforce/storefront-next-runtime/site-context';

/** Catalog id of the top-level "activity" category (Running / Trail / Training / …). */
const ACTIVITY_PARENT_CATEGORY_ID = 'activity';

/** Custom attributes read directly off the product/hit — no BM refinement config assumed. */
const PERFORMANCE_SPEC_ATTRIBUTES = ['c_terrain', 'c_cushioning', 'c_supportType'] as const;
type PerformanceSpecKey = (typeof PERFORMANCE_SPEC_ATTRIBUTES)[number];

/** Wide enough candidate pool to survive self-exclusion + spec filtering without a second round-trip. */
const CANDIDATE_POOL_SIZE = 48;

/**
 * Finds the activity-level category id for a product by walking its primary category's
 * ancestor chain and returning the entry immediately under the catalog's `activity` parent.
 * Returns undefined for products outside the activity tree (e.g. accessories), so callers
 * can skip the rail rather than show unrelated recommendations.
 */
export function getActivityCategoryId(product: ShopperProducts.schemas['Product']): string | undefined {
    const primaryCategory = product.primaryCategory;
    if (!primaryCategory) return undefined;

    const tree = primaryCategory.parentCategoryTree ?? [];
    const activityIndex = tree.findIndex((entry) => entry.id === ACTIVITY_PARENT_CATEGORY_ID);
    if (activityIndex === -1) return undefined;

    // `activity`'s immediate child is the next ancestor entry, unless `activity` is the direct
    // parent of the primary category itself (nothing between them in the ancestor chain).
    return activityIndex === tree.length - 1 ? primaryCategory.id : tree[activityIndex + 1]?.id;
}

function normalizeSpecValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
    if (typeof value === 'string' && value) return [value];
    return [];
}

/**
 * Reads one performance-spec attribute off a product or search hit, tolerating both shapes it can
 * arrive in: a flat `c_<name>` key — the raw Shopper Search/Products payload, where custom attributes
 * surface directly on the object under the `custom_properties` expansion — and a normalized
 * `customProperties: [{ id, value }]` array (the product-content adapter shape). The flat key is the
 * common path, so it wins; the array is consulted only when the flat key is absent, keeping the rail
 * matched even when a hit carries its specs in the array form instead.
 */
function readSpecValues(source: Record<string, unknown>, key: PerformanceSpecKey): string[] {
    const flat = normalizeSpecValues(source[key]);
    if (flat.length) return flat;

    const custom = source.customProperties;
    if (Array.isArray(custom)) {
        const entry = (custom as Array<{ id?: unknown; value?: unknown }>).find((prop) => prop?.id === key);
        if (entry) return normalizeSpecValues(entry.value);
    }

    return [];
}

function readPerformanceSpecs(product: ShopperProducts.schemas['Product']): Map<PerformanceSpecKey, Set<string>> {
    const record = product as unknown as Record<string, unknown>;
    const specs = new Map<PerformanceSpecKey, Set<string>>();

    for (const key of PERFORMANCE_SPEC_ATTRIBUTES) {
        const values = readSpecValues(record, key);
        if (values.length) specs.set(key, new Set(values));
    }

    return specs;
}

function hasMatchingPerformanceSpec(
    hit: ShopperSearch.schemas['ProductSearchHit'],
    productSpecs: Map<PerformanceSpecKey, Set<string>>
): boolean {
    const record = hit as unknown as Record<string, unknown>;

    for (const [key, values] of productSpecs) {
        const hitValues = readSpecValues(record, key);
        if (hitValues.some((value) => values.has(value))) return true;
    }

    return false;
}

/**
 * The set of product ids that mean "this is the product on the current PDP": the current
 * variant's own sku (`product.id`) plus its master sku (`product.master?.masterId`). On a variant
 * PDP `product.id` is the selected variant sku, so a category search hit (whose `productId` is the
 * master sku) would otherwise slip past a plain `productId !== product.id` check and surface the
 * current shoe in its own rails. Matching the master id as well closes that gap. See the variant
 * identity chain documented in `data360.ts`.
 */
function currentProductIdentity(product: ShopperProducts.schemas['Product']): Set<string> {
    const ids = new Set<string>();
    if (product.id) ids.add(product.id);
    const masterId = product.master?.masterId;
    if (masterId) ids.add(masterId);
    return ids;
}

/**
 * Every product id a search hit can carry back to a concrete product: its own `productId`, any
 * represented-product ids (single `representedProduct` and the `representedProducts` array), and the
 * skus of its variants and variation groups. On a variant PDP the viewed sku can appear on a
 * variation-group hit only under `variants[].productId` — the hit's own `productId` is then the
 * variation-group/master sku — so without checking those the current shoe slips past the identity
 * exclusion and links back to its own PDP. Tested against {@link currentProductIdentity} to decide
 * whether the hit is the current product.
 */
function isCurrentProduct(hit: ShopperSearch.schemas['ProductSearchHit'], identity: Set<string>): boolean {
    if (identity.has(hit.productId)) return true;
    if (hit.representedProduct?.id && identity.has(hit.representedProduct.id)) return true;
    if ((hit.representedProducts ?? []).some((rep) => rep?.id != null && identity.has(rep.id))) return true;
    if ((hit.variants ?? []).some((variant) => variant?.productId != null && identity.has(variant.productId)))
        return true;
    return (hit.variationGroups ?? []).some((group) => group?.productId != null && identity.has(group.productId));
}

/**
 * Fetches the shared candidate pool that feeds both footwear PDP rails in a single SCAPI search:
 * other products under the current product's activity category (Running/Trail/Training/…). The
 * loader resolves this once and derives both "Also in This Activity" and "Similar Performance"
 * from the resolved hits, so the category search runs once per PDP rather than once per rail.
 * Returns an empty pool — without searching — for products outside the activity tree, and an
 * empty pool when the search fails, so both rails degrade to nothing rather than surfacing an error.
 */
export async function fetchActivityCandidatePool(
    context: LoaderFunctionArgs['context'],
    product: ShopperProducts.schemas['Product']
): Promise<ShopperSearch.schemas['ProductSearchHit'][]> {
    const activityCategoryId = getActivityCategoryId(product);
    if (!activityCategoryId) return [];

    const { currency } = context.get(siteContext) as SiteContext;
    const result = await fetchCarouselProducts(context, {
        categoryId: activityCategoryId,
        limit: CANDIDATE_POOL_SIZE,
        currency: currency ?? undefined,
    }).catch(() => null);

    return result?.hits ?? [];
}

/**
 * "Also in This Activity" rail: other products from the shared candidate pool, excluding the
 * current product itself. Pure derivation over an already-resolved pool — see {@link fetchActivityCandidatePool}.
 */
export function deriveActivityMatched(
    hits: ShopperSearch.schemas['ProductSearchHit'][],
    product: ShopperProducts.schemas['Product'],
    limit = 12
): Recommendation {
    const identity = currentProductIdentity(product);
    const recs = hits.filter((hit) => !isCurrentProduct(hit, identity)).slice(0, limit);
    return recs.length ? { recs } : {};
}

/**
 * "Similar Performance" rail: candidate-pool products that share at least one performance-spec
 * attribute (terrain, cushioning, support type) with the current product. Filters client-side
 * against the shared pool rather than refining by these attributes server-side, since BM may not
 * have them configured as searchable/refinable. Pure derivation — see {@link fetchActivityCandidatePool}.
 */
export function derivePerformanceMatched(
    hits: ShopperSearch.schemas['ProductSearchHit'][],
    product: ShopperProducts.schemas['Product'],
    limit = 12
): Recommendation {
    const productSpecs = readPerformanceSpecs(product);
    if (!productSpecs.size) return {};

    const identity = currentProductIdentity(product);
    const recs = hits
        .filter((hit) => !isCurrentProduct(hit, identity))
        .filter((hit) => hasMatchingPerformanceSpec(hit, productSpecs))
        .slice(0, limit);
    return recs.length ? { recs } : {};
}
