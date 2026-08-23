// SPDX-License-Identifier: AGPL-3.0-or-later

import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import LumeLogoAsset from '@app/media/images/lume-logo.png';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {getDataFlx, getImageSizingProps} from './BrandImageUtils';

const APPLICATION_ICON_DESCRIPTOR = msg({
	message: '{productName} application icon',
	comment: 'Accessible label for the Fluxer application icon.',
});
export const FluxerIcon = observer((props: React.SVGProps<SVGSVGElement>) => {
	const {i18n} = useLingui();
	const ariaLabel = i18n._(APPLICATION_ICON_DESCRIPTOR, {productName: RuntimeConfig.productName});
	if (RuntimeConfig.iconUrl) {
		return (
			<img
				{...getImageSizingProps(props)}
				src={RuntimeConfig.iconUrl}
				alt={ariaLabel}
				data-flx={getDataFlx(props, 'ui.icons.fluxer-icon.img')}
			/>
		);
	}
	return (
		<img
			{...getImageSizingProps(props)}
			src={LumeLogoAsset}
			alt={ariaLabel}
			data-flx={getDataFlx(props, 'ui.icons.fluxer-icon.img')}
		/>
	);
});
