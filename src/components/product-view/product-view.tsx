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
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import type { ShopperProducts } from '@/scapi';
import ProductZoomGallery from '@/components/product-zoom-gallery';
import ProductInfo from './product-info';
import ProductCartActions from '@/components/product-cart-actions';
import ProductViewProvider from '@/providers/product-view';
import { useProductImages } from '@/hooks/product/use-product-images';
import { useSelectedVariations } from '@/hooks/product/use-selected-variations';
import { useCurrentVariant } from '@/hooks/product/use-current-variant';
import { useScapiFetcher } from '@/hooks/use-scapi-fetcher';
// @sfdc-extension-block-start SFDC_EXT_BOPIS
import { useStoreLocator } from '@/extensions/store-locator/providers/store-locator';
import { usePickupInventory } from '@/extensions/bopis/context/pickup-inventory';
// @sfdc-extension-block-end SFDC_EXT_BOPIS
import { isProductSet, isProductBundle } from '@/lib/product/product-utils';
import { usesInlineAddToCartQuantity } from '@/lib/product/add-to-cart-quantity-mode';
import CollapsibleHtmlSection from '@/components/collapsible-section/collapsible-html-section';
import { useTranslation } from 'react-i18next';
import { useRouteLoaderData } from 'react-router';
import { UITarget } from '@/targets/ui-target';
import EmbeddedAgentWidget, { isEmbeddedAgentConfigured, parsePdpQuestions } from '@/components/embedded-agent';
import type { loader as rootLoader } from '@/root';

interface ProductViewProps {
    product: ShopperProducts.schemas['Product'];
    mode?: 'add' | 'edit';
}

/**
 * Inventory-list id for a synthesized "unavailable" record. The colorway overlay runs its own
 * authoritative per-SKU availability fetch; when that fetch omits the site inventory, we stamp an
 * explicit unavailable record with this id so downstream inventory helpers can't silently fall back
 * to the master product's availability. The value is a sentinel -- it never matches a real store id.
 */
const UNAVAILABLE_INVENTORY_ID = 'unavailable';

/** Footwear PDP overlay with local variation state so colorway changes do not navigate. */
export default function ProductView({ product }: ProductViewProps): ReactElement {
    const isProductASet = isProductSet(product);
    const isProductABundle = isProductBundle(product);
    const urlVariationValues = useSelectedVariations({ product });
    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    const selectedStoreInfo = useStoreLocator((store) => store.selectedStoreInfo);
    // @sfdc-extension-block-end SFDC_EXT_BOPIS
    const [selectedColorway, setSelectedColorway] = useState(urlVariationValues.color);
    const productIdRef = useRef(product.id);
    const urlColorwayRef = useRef(urlVariationValues.color);

    useEffect(() => {
        if (productIdRef.current !== product.id) {
            productIdRef.current = product.id;
            setSelectedColorway(urlVariationValues.color);
        }
    }, [product.id, urlVariationValues]);

    useEffect(() => {
        if (urlColorwayRef.current !== urlVariationValues.color) {
            urlColorwayRef.current = urlVariationValues.color;
            setSelectedColorway(urlVariationValues.color);
        }
    }, [urlVariationValues.color]);

    // Build a plain Record so the object stays string-indexable below. A bare object spread of a
    // Record<string, string> drops the index signature, narrowing the result to the literal keys
    // only ({ color?: string }), which then can't be indexed by an arbitrary attribute id.
    const variationValues = useMemo<Record<string, string>>(() => {
        const next: Record<string, string> = { ...urlVariationValues };
        if (selectedColorway) {
            next.color = selectedColorway;
        }
        return next;
    }, [urlVariationValues, selectedColorway]);
    const selectedVariant = useCurrentVariant({ product, selectionsOverride: variationValues });
    const selectedVariantId = selectedVariant?.productId;
    const initialSku = useRef({ product, id: selectedVariantId, changed: false });
    if (initialSku.current.product !== product) initialSku.current = { product, id: selectedVariantId, changed: false };
    if (initialSku.current.id !== selectedVariantId) initialSku.current.changed = true;
    // @sfdc-extension-line SFDC_EXT_BOPIS
    const streamed = usePickupInventory(selectedVariantId ?? product.id);
    const hasVariantSelection = product.type?.master === true && (product.variants?.length ?? 0) > 0;
    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    const inventoryIds = selectedStoreInfo?.inventoryId ? [selectedStoreInfo.inventoryId] : undefined;
    // @sfdc-extension-block-end SFDC_EXT_BOPIS
    const variantFetcher = useScapiFetcher('shopperProducts', 'getProduct', {
        params: {
            path: { id: selectedVariantId ?? '' },
            query: {
                expand: ['availability', 'prices', 'variations'],
                // @sfdc-extension-block-start SFDC_EXT_BOPIS
                ...(inventoryIds ? { inventoryIds } : {}),
                // @sfdc-extension-block-end SFDC_EXT_BOPIS
            },
        },
    });
    const variantData = { value: variantFetcher.success ? variantFetcher.data : undefined };
    const initialSkuInventory = (selectedVariant as { inventory?: ShopperProducts.schemas['Inventory'] } | undefined)
        ?.inventory;
    if (!variantData.value && !initialSku.current.changed && selectedVariantId && initialSkuInventory)
        variantData.value = { id: selectedVariantId, inventory: initialSkuInventory };
    // @sfdc-extension-block-start SFDC_EXT_BOPIS
    if (!(variantFetcher.success && variantFetcher.data?.id === selectedVariantId) && streamed.product)
        variantData.value = { ...product, ...streamed.product };
    // @sfdc-extension-block-end SFDC_EXT_BOPIS
    const hasSelectedVariantInventory = variantData.value?.id === selectedVariantId;
    // Pending only once a variant is selected; with nothing selected there is no inventory to wait for.
    const isVariantInventoryLoading = hasVariantSelection && selectedVariantId != null && !hasSelectedVariantInventory;
    const isVariantInventoryLoadError = Boolean(variantFetcher.errors);

    useEffect(() => {
        if (
            selectedVariantId &&
            // @sfdc-extension-line SFDC_EXT_BOPIS
            !(streamed.active && streamed.isInitialSelection && (streamed.status === 'pending' || streamed.product)) &&
            isVariantInventoryLoading &&
            variantFetcher.state === 'idle' &&
            !variantFetcher.errors &&
            variantFetcher.data?.id !== selectedVariantId
        ) {
            void variantFetcher.load();
        }
    }, [
        isVariantInventoryLoading,
        selectedVariantId,
        variantFetcher,
        // @sfdc-extension-line SFDC_EXT_BOPIS
        streamed.active,
        // @sfdc-extension-line SFDC_EXT_BOPIS
        streamed.isInitialSelection,
        // @sfdc-extension-line SFDC_EXT_BOPIS
        streamed.status,
        // @sfdc-extension-line SFDC_EXT_BOPIS
        streamed.product,
    ]);

    const currentVariant = useMemo(() => {
        if (!selectedVariant) return undefined;
        if (!hasSelectedVariantInventory || !variantData.value) return selectedVariant;

        // This overlay fetches the selected SKU's authoritative availability itself, so a 200 that
        // omits the site inventory or the requested store means "no record for this SKU there" --
        // not "borrow the master product's numbers". Stamp explicit unavailable records for the
        // gaps so getEffectiveInventory / isSiteOutOfStock can't fall back to the master and wrongly
        // re-enable delivery, pickup, or Add to Cart for a SKU that has no inventory at all.
        const fetchedInventory = variantData.value.inventory;
        const fetchedInventories = variantData.value.inventories ?? [];

        const siteInventory: ShopperProducts.schemas['Inventory'] = fetchedInventory ?? {
            id: UNAVAILABLE_INVENTORY_ID,
            orderable: false,
            ats: 0,
            stockLevel: 0,
        };

        const inventories = [
            ...fetchedInventories,
            // @sfdc-extension-block-start SFDC_EXT_BOPIS
            ...(selectedStoreInfo?.inventoryId &&
            !fetchedInventories.some((inv) => inv.id === selectedStoreInfo.inventoryId)
                ? [{ id: selectedStoreInfo.inventoryId, orderable: false, ats: 0, stockLevel: 0 }]
                : []),
            // @sfdc-extension-block-end SFDC_EXT_BOPIS
        ];

        return {
            ...selectedVariant,
            inventory: siteInventory,
            inventories,
            orderable: siteInventory.orderable ?? false,
        };
    }, [
        selectedVariant,
        hasSelectedVariantInventory,
        variantData.value,
        // @sfdc-extension-block-start SFDC_EXT_BOPIS
        selectedStoreInfo?.inventoryId,
        // @sfdc-extension-block-end SFDC_EXT_BOPIS
    ]);

    const handleColorwayChange = (_attributeId: string, value: string) => {
        if (selectedColorway === value) return;

        setSelectedColorway(value);
    };

    const colorwayImageGroup = product.imageGroups?.find(
        (imageGroup) =>
            imageGroup.viewType === 'large' &&
            imageGroup.variationAttributes?.some(
                (attribute) =>
                    attribute.id === 'color' && attribute.values?.some((value) => value.value === selectedColorway)
            ) &&
            imageGroup.variationAttributes.every(
                (attribute) =>
                    attribute.id === 'color' ||
                    attribute.values?.some((value) => value.value === variationValues[attribute.id])
            )
    );
    const galleryProduct = useMemo(
        () =>
            selectedColorway
                ? {
                      ...product,
                      imageGroups: colorwayImageGroup ? [colorwayImageGroup] : [],
                  }
                : product,
        [product, selectedColorway, colorwayImageGroup]
    );
    const { galleryImages } = useProductImages({
        product: galleryProduct,
        selectedAttributes: selectedColorway ? undefined : variationValues,
    });
    const { t } = useTranslation('product');
    const rootData = useRouteLoaderData<typeof rootLoader>('root');
    const embeddedAgent = rootData?.appConfig?.commerce?.embeddedAgent;
    const pdpQuestions = parsePdpQuestions((product as unknown as { c_pdpQuestions?: unknown }).c_pdpQuestions);

    return (
        <ProductViewProvider
            product={product}
            mode="add"
            currentVariant={currentVariant}
            selectionsOverride={variationValues}
            isVariantInventoryLoading={isVariantInventoryLoading}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-12">
                <div className="order-1">
                    <ProductZoomGallery
                        key={product.id}
                        images={galleryImages}
                        eager={!isProductASet && !isProductABundle}
                        showNavigationArrows
                        navigationArrowSize="lg"
                        productName={product.name}
                    />
                    <UITarget targetId="sfcc.pdp.agent.productHelper" />
                    {product.longDescription && product.longDescription !== product.shortDescription && (
                        <CollapsibleHtmlSection
                            label={`${t('description')}:`}
                            content={product.longDescription}
                            contentType="bulleted-list"
                            defaultOpen
                            className="mt-6"
                        />
                    )}
                </div>

                <div className="order-2">
                    <ProductInfo
                        product={product}
                        showQuantityPicker={!usesInlineAddToCartQuantity()}
                        swatchMode="controlled"
                        variationValues={variationValues}
                        controlledAttributeIds={['color']}
                        onAttributeChange={handleColorwayChange}
                        colorwaysIgnoreSelectedAttributes
                        currentVariantOverride={currentVariant}
                        isVariantInventoryLoading={isVariantInventoryLoading}
                        isVariantInventoryLoadError={isVariantInventoryLoadError}
                        onRetryVariantInventory={() => void variantFetcher.load()}
                        // @sfdc-extension-block-start SFDC_EXT_BOPIS
                        // @sfdc-extension-line SFDC_EXT_SHIPPING_DELIVERY
                        enableDeliveryEstimatePresentation
                        // @sfdc-extension-block-end SFDC_EXT_BOPIS
                    />
                    <ProductCartActions
                        product={product}
                        showInlineCartQuantity={!isProductASet && !isProductABundle && usesInlineAddToCartQuantity()}
                    />
                    {isEmbeddedAgentConfigured(embeddedAgent) && !isProductASet && !isProductABundle && (
                        <div className="mt-6">
                            <EmbeddedAgentWidget
                                config={embeddedAgent}
                                pdpQuestions={pdpQuestions}
                                productName={product.name}
                            />
                        </div>
                    )}
                    <UITarget targetId="sfcc.pdp.returnsWarranty" />
                    <UITarget targetId="sfcc.pdp.collapsibles" />
                </div>
            </div>
        </ProductViewProvider>
    );
}
