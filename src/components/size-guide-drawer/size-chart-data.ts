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

export interface SizeChartEntry {
    us: string;
    uk: string;
    eu: string;
    cm: string;
    jp?: string;
}

export type SizeGuideGender = 'mens' | 'womens' | 'kids';

/**
 * Shipped static size-conversion tables, used when a product has no
 * `c_sizeChart` custom attribute (or it fails to parse). Values are standard
 * industry US/UK/EU/CM conversions and are gender-specific because the same
 * US size number maps to different UK/EU sizes for mens vs womens lasts.
 */
export const DEFAULT_SIZE_CHARTS: Record<SizeGuideGender, SizeChartEntry[]> = {
    mens: [
        { us: '7', uk: '6', eu: '40', cm: '25', jp: '25' },
        { us: '7.5', uk: '6.5', eu: '40.5', cm: '25.5', jp: '25.5' },
        { us: '8', uk: '7', eu: '41', cm: '26', jp: '26' },
        { us: '8.5', uk: '7.5', eu: '42', cm: '26.5', jp: '26.5' },
        { us: '9', uk: '8', eu: '42.5', cm: '27', jp: '27' },
        { us: '9.5', uk: '8.5', eu: '43', cm: '27.5', jp: '27.5' },
        { us: '10', uk: '9', eu: '44', cm: '28', jp: '28' },
        { us: '10.5', uk: '9.5', eu: '44.5', cm: '28.5', jp: '28.5' },
        { us: '11', uk: '10', eu: '45', cm: '29', jp: '29' },
        { us: '11.5', uk: '10.5', eu: '45.5', cm: '29.5', jp: '29.5' },
        { us: '12', uk: '11', eu: '46', cm: '30', jp: '30' },
        { us: '13', uk: '12', eu: '47', cm: '31', jp: '31' },
    ],
    womens: [
        { us: '5', uk: '2.5', eu: '35.5', cm: '22', jp: '22' },
        { us: '5.5', uk: '3', eu: '36', cm: '22.5', jp: '22.5' },
        { us: '6', uk: '3.5', eu: '36.5', cm: '23', jp: '23' },
        { us: '6.5', uk: '4', eu: '37.5', cm: '23.5', jp: '23.5' },
        { us: '7', uk: '4.5', eu: '38', cm: '24', jp: '24' },
        { us: '7.5', uk: '5', eu: '38.5', cm: '24.5', jp: '24.5' },
        { us: '8', uk: '5.5', eu: '39', cm: '25', jp: '25' },
        { us: '8.5', uk: '6', eu: '39.5', cm: '25.5', jp: '25.5' },
        { us: '9', uk: '6.5', eu: '40.5', cm: '26', jp: '26' },
        { us: '9.5', uk: '7', eu: '41', cm: '26.5', jp: '26.5' },
        { us: '10', uk: '7.5', eu: '42', cm: '27', jp: '27' },
        { us: '11', uk: '8.5', eu: '43', cm: '28', jp: '28' },
    ],
    kids: [
        { us: '10.5', uk: '9.5', eu: '27', cm: '16.5' },
        { us: '11', uk: '10', eu: '28', cm: '17' },
        { us: '11.5', uk: '10.5', eu: '29', cm: '17.5' },
        { us: '12', uk: '11', eu: '30', cm: '18' },
        { us: '12.5', uk: '11.5', eu: '30.5', cm: '18.5' },
        { us: '13', uk: '12', eu: '31', cm: '19' },
        { us: '13.5', uk: '12.5', eu: '32', cm: '19.5' },
        { us: '1', uk: '13', eu: '33', cm: '20' },
        { us: '1.5', uk: '13.5', eu: '33.5', cm: '20.5' },
        { us: '2', uk: '1', eu: '34', cm: '21' },
        { us: '2.5', uk: '1.5', eu: '34.5', cm: '21.5' },
        { us: '3', uk: '2', eu: '35', cm: '22' },
    ],
};

/**
 * Parses a product's `c_sizeChart` custom attribute (a JSON-stringified
 * `SizeChartEntry[]`) and falls back to the shipped static table for the
 * given gender when the attribute is missing, empty, or malformed.
 */
export function parseSizeChart(rawSizeChart: unknown, gender: SizeGuideGender): SizeChartEntry[] {
    if (typeof rawSizeChart === 'string' && rawSizeChart.length > 0) {
        try {
            const parsed = JSON.parse(rawSizeChart);
            if (Array.isArray(parsed) && parsed.every(isSizeChartEntry)) {
                return parsed;
            }
        } catch {
            // fall through to static default
        }
    }

    return DEFAULT_SIZE_CHARTS[gender];
}

function isSizeChartEntry(value: unknown): value is SizeChartEntry {
    if (typeof value !== 'object' || value === null) return false;
    const entry = value as Record<string, unknown>;
    return (
        typeof entry.us === 'string' &&
        typeof entry.uk === 'string' &&
        typeof entry.eu === 'string' &&
        typeof entry.cm === 'string'
    );
}

/**
 * Derives the size-guide gender from a product's category, since no `c_gender` custom
 * attribute exists in the catalog. Matches category id/name against `womens`/`kids` patterns
 * (checked before `mens`, since `womens` contains `mens`) and defaults to `mens` when neither
 * matches, so the drawer/indicator always has a valid chart to show.
 */
export function deriveGenderFromCategory(categoryId: string | undefined): SizeGuideGender {
    const haystack = (categoryId ?? '').toLowerCase();
    if (/kids?|junior|youth/.test(haystack)) return 'kids';
    if (/wom[ae]ns?/.test(haystack)) return 'womens';
    return 'mens';
}
