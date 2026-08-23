// SPDX-License-Identifier: AGPL-3.0-or-later

// The self-hosted backend still exposes its upstream product name in the
// bootstrap payload. The client brand is intentionally owned here so a
// backend upgrade cannot silently revert visible copy to the upstream name.
export const PRODUCT_NAME = 'Lume';
export const PREMIUM_PRODUCT_NAME = 'Plus';
export const PREMIUM_PRODUCT_FULL_NAME = `${PRODUCT_NAME} ${PREMIUM_PRODUCT_NAME}`;
