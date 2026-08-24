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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShopperProducts } from '@/scapi';
import type { GalleryImage } from '@/components/image-gallery';
import { findImageGroupBy } from '@/lib/product/image-groups-utils';
import { isDynamicImageSource, toImageUrl } from '@/lib/images/dynamic-image';
import { useConfig } from '@salesforce/storefront-next-runtime/config';

interface UseProductImagesProps {
    product: ShopperProducts.schemas['Product'];
    selectedAttributes?: Record<string, string>;
    viewType?: string;
}

interface UseProductImagesReturn {
    galleryImages: GalleryImage[];
}

const getDefaultImages = (
    imageGroups: ShopperProducts.schemas['ImageGroup'][] | undefined,
    viewType: string = 'large'
): ShopperProducts.schemas['Image'][] => {
    return imageGroups?.find((group) => group.viewType === viewType)?.images || [];
};

type ShoeAngle = 'front' | 'side' | 'back' | 'sole';

/** Detection priority when a single alt names more than one angle keyword (e.g. "front sole"): first wins. */
const ANGLE_PRIORITY: ShoeAngle[] = ['front', 'side', 'back', 'sole'];

/** Base language subtag whose vocabulary is used when the active language has no entry below. */
const DEFAULT_ANGLE_LANG = 'en';

/**
 * Angle keywords per catalog language, matched case-insensitively against merchant alt text. Alt
 * copy is authored in the storefront's language, so detection needs the vocabulary for that
 * language — an English-only match would surface no angle on a localized catalog. Keyed by base
 * language subtag; add a language here to detect its alt copy. The label shown to shoppers still
 * comes from that locale's `gallery.thumbnailAngle.*` translation, not from these keywords.
 */
const ANGLE_KEYWORDS_BY_LANG: Record<string, Record<ShoeAngle, string[]>> = {
    en: {
        front: ['front'],
        side: ['side', 'profile'],
        back: ['back', 'rear', 'heel'],
        sole: ['sole', 'bottom', 'outsole', 'tread'],
    },
    it: {
        front: ['frontale', 'anteriore'],
        side: ['laterale', 'profilo'],
        back: ['posteriore', 'tallone'],
        sole: ['suola', 'battistrada'],
    },
};

/**
 * Compiles one boundary-safe matcher per keyword. Uses Unicode-aware lookarounds (with the `u`
 * flag) instead of `\b`: JavaScript's `\b` is ASCII-only, so an accented neighbour like `réside`
 * counts `é` as a non-word char and `\bside\b` would match inside it, fabricating a "Side view".
 * The boundary classes exclude Unicode letters (`\p{L}`), numbers (`\p{N}`), and combining marks
 * (`\p{M}`), so a keyword matches only as a standalone token. `\p{M}` is what catches decomposed
 * accents: in NFD, `réside` places a combining acute (a mark, not a letter) before "side",
 * which a letters-and-numbers-only class would let through and mislabel as "Side view". `detectAngle`
 * also normalizes alt to NFC first, recomposing most accents into single letters; excluding `\p{M}`
 * covers any residual mark that has no precomposed form. This still blocks the ASCII false positives:
 * "side" in "Inside cushioning", "back" in "Feedback technology", "tread" in "treadmill". All angle
 * keywords are plain ASCII, so interpolating them into the pattern needs no escaping.
 */
function compileAnglePatterns(keywords: Record<ShoeAngle, string[]>): Record<ShoeAngle, RegExp[]> {
    const boundarySafe = (keyword: string) =>
        new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])${keyword}(?![\\p{L}\\p{N}\\p{M}])`, 'u');
    return {
        front: keywords.front.map(boundarySafe),
        side: keywords.side.map(boundarySafe),
        back: keywords.back.map(boundarySafe),
        sole: keywords.sole.map(boundarySafe),
    };
}

/** Patterns precompiled once per language so `detectAngle` never rebuilds regexes per image. */
const ANGLE_KEYWORD_PATTERNS_BY_LANG: Record<string, Record<ShoeAngle, RegExp[]>> = Object.fromEntries(
    Object.entries(ANGLE_KEYWORDS_BY_LANG).map(([lang, keywords]) => [lang, compileAnglePatterns(keywords)])
);

/** English fallback view labels, used as the `defaultValue` passed to `t()` for locales without a footwear override. */
const ANGLE_VIEW_DEFAULT: Record<ShoeAngle, string> = {
    front: 'Front view',
    side: 'Side view',
    back: 'Back view',
    sole: 'Sole view',
};

/**
 * Detects a shoe angle from a merchant-supplied alt string using boundary-safe keyword matching in
 * the catalog's language. Returns undefined when the alt is absent or names no angle — the caller
 * then exposes no angle at all, so an angle is only ever surfaced when it comes from the merchant's
 * own description. Languages without their own vocabulary fall back to English keywords.
 *
 * Exported so the per-language vocabularies can be unit-tested directly (the hook wires the active
 * `i18n.language`, which a bare test harness does not provide).
 *
 * @param alt merchant-supplied alt text for a single product image
 * @param lang base language subtag (e.g. `en`, `it`); unknown languages use the English vocabulary
 */
export function detectAngle(alt: string | undefined, lang: string = DEFAULT_ANGLE_LANG): ShoeAngle | undefined {
    if (!alt) return undefined;
    const patterns = ANGLE_KEYWORD_PATTERNS_BY_LANG[lang] ?? ANGLE_KEYWORD_PATTERNS_BY_LANG[DEFAULT_ANGLE_LANG];
    // Recompose decomposed accents (NFD `re´side` -> NFC `réside`) so a combining mark never sits
    // between a keyword and its neighbour; the `\p{M}` boundary class covers any mark NFC can't fold.
    const lower = alt.normalize('NFC').toLowerCase();
    return ANGLE_PRIORITY.find((angle) => patterns[angle].some((pattern) => pattern.test(lower)));
}

/**
 * Footwear overlay of `useProductImages`: identical image resolution/filtering, plus — when the
 * merchant's own alt text reliably names a shoe angle (boundary-safe match) — a localized view
 * label ("Front view", …) surfaced as the thumbnail selector button's accessible name via
 * `GalleryImage.thumbnailLabel`. The alt text itself is left exactly as the merchant authored it
 * (or the product-name fallback); no inferred or positional angle is ever written into `alt`.
 */
export function useProductImages({
    product,
    selectedAttributes,
    viewType = 'large',
}: UseProductImagesProps): UseProductImagesReturn {
    const config = useConfig();
    const { t, i18n } = useTranslation('product');

    const filteredImages = useMemo(() => {
        if (!selectedAttributes || Object.keys(selectedAttributes).length === 0) {
            return getDefaultImages(product.imageGroups, viewType);
        }

        const imageGroup = findImageGroupBy(product.imageGroups || [], {
            viewType,
            selectedVariationAttributes: selectedAttributes,
        });

        return imageGroup?.images || getDefaultImages(product.imageGroups, viewType);
    }, [product.imageGroups, selectedAttributes, viewType]);

    const galleryImages: GalleryImage[] = useMemo(() => {
        if (!filteredImages || filteredImages.length === 0) {
            return [];
        }

        const sources = filteredImages.filter((image) => isDynamicImageSource(image.disBaseLink ?? image.link));
        // Match angle keywords in the catalog's language (alt copy is authored per storefront locale).
        const lang = (i18n.language || DEFAULT_ANGLE_LANG).toLowerCase().split('-')[0];

        return sources.map((image): GalleryImage => {
            const optimizedImageUrl = toImageUrl({ image, config }) || '';
            // Detect the angle only from the merchant's own per-image alt — never the product name,
            // which is a title, not a view descriptor.
            const angle = detectAngle(image.alt, lang);
            // `defaultValue` widens the i18next key type to `string` (same pattern as
            // size-guide-content.tsx) since these footwear-only keys aren't in canonical
            // translations, and doubles as the real fallback for any locale without a
            // footwear overrides file.
            const thumbnailLabel = angle
                ? t(`gallery.thumbnailAngle.${angle}`, { defaultValue: ANGLE_VIEW_DEFAULT[angle] })
                : undefined;

            return {
                src: optimizedImageUrl,
                alt: image.alt || product.name || '',
                thumbSrc: optimizedImageUrl,
                ...(thumbnailLabel ? { thumbnailLabel } : {}),
            };
        });
    }, [filteredImages, product.name, config, t, i18n.language]);

    return {
        galleryImages,
    };
}
