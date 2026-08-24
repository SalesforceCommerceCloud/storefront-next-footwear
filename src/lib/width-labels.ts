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
import type { TFunction } from 'i18next';

/**
 * Standard US shoe-width codes → human-readable labels, keyed by the code a catalog
 * ships as a width variation-attribute value.
 *
 * When the catalog only provides bare codes (e.g. "B"/"D") as the value's display name,
 * `<WidthSelector displayMode="labels">` and the low-stock message would otherwise show
 * the raw code. Mapping them here keeps both surfaces reading the same spelled-out label.
 *
 * A catalog that already spells out its width name ("Wide", "Standard") is left untouched:
 * only bare codes present in this table are rewritten, so real merchant data passes through.
 * `defaultValue` widens the i18next key type to `string` (these footwear-only keys aren't in
 * canonical translations) and doubles as the fallback for any locale without a footwear
 * overrides file.
 */
const WIDTH_CODE_LABELS: Record<string, { key: string; defaultValue: string }> = {
    B: { key: 'width.narrow', defaultValue: 'Narrow' },
    D: { key: 'width.standard', defaultValue: 'Standard' },
    '2E': { key: 'width.wide', defaultValue: 'Wide' },
    '4E': { key: 'width.extraWide', defaultValue: 'Extra Wide' },
    '6E': { key: 'width.extraExtraWide', defaultValue: 'Extra Extra Wide' },
};

/**
 * Resolves a width variation-attribute value to a shopper-facing label.
 *
 * Returns the mapped label when `raw` is a recognised bare width code, the input unchanged
 * when it is already a spelled-out name (or has no mapping), and `undefined`/empty as-is so
 * callers can keep their own fallback (`?? value.value`).
 */
export function resolveWidthLabel(t: TFunction<'product'>, raw: string | undefined): string | undefined {
    if (!raw) return raw;
    const entry = WIDTH_CODE_LABELS[raw.trim().toUpperCase()];
    return entry ? t(entry.key, { defaultValue: entry.defaultValue }) : raw;
}
