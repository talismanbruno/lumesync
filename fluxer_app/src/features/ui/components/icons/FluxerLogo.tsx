// SPDX-License-Identifier: AGPL-3.0-or-later

import {PRODUCT_NAME} from '@app/features/app/config/I18nDisplayConstants';
import LumeLogoAsset from '@app/media/images/lume-logo.png';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {type BrandSvgProps, getDataFlx, getImageSizingProps} from './BrandImageUtils';

const APPLICATION_LOGO_DESCRIPTOR = msg({
	message: '{productName} application logo',
	comment: 'Accessible label for the application logo.',
});

export const FluxerLogo = observer((props: BrandSvgProps) => {
	const {i18n} = useLingui();
	const ariaLabel = i18n._(APPLICATION_LOGO_DESCRIPTOR, {productName: PRODUCT_NAME});
	return (
		<img
			{...getImageSizingProps(props)}
			src={LumeLogoAsset}
			alt={ariaLabel}
			data-flx={getDataFlx(props, 'ui.icons.fluxer-logo.img')}
		/>
	);
});
