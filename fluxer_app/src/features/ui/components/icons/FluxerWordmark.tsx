// SPDX-License-Identifier: AGPL-3.0-or-later

import {PRODUCT_NAME} from '@app/features/app/config/I18nDisplayConstants';
import LumeWordmarkAsset from '@app/media/images/lume-wordmark.png';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {type BrandSvgProps, getDataFlx, getImageSizingProps} from './BrandImageUtils';

const APPLICATION_WORDMARK_DESCRIPTOR = msg({
	message: '{productName} wordmark',
	comment: 'Accessible label for the application wordmark.',
});

interface FluxerWordmarkProps extends BrandSvgProps {
	variant?: 'default' | 'monochrome';
}

export const FluxerWordmark = observer(({variant = 'default', ...props}: FluxerWordmarkProps) => {
	const {i18n} = useLingui();
	const ariaLabel = i18n._(APPLICATION_WORDMARK_DESCRIPTOR, {productName: PRODUCT_NAME});
	return (
		<img
			{...getImageSizingProps(props)}
			src={LumeWordmarkAsset}
			alt={ariaLabel}
			data-flx={getDataFlx(props, `ui.icons.fluxer-wordmark.img.${variant}`)}
		/>
	);
});
