// SPDX-License-Identifier: AGPL-3.0-or-later

import StreamerMode from '@app/features/streamer_mode/state/StreamerMode';
import type {User} from '@app/features/user/models/User';

function truncateStreamerModeName(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '…';
	return `${Array.from(trimmed)[0]}…`;
}

export function getLumePublicTag(user: User): string {
	if (!user.isStaff()) return user.tag;
	const parsedDiscriminator = Number.parseInt(user.discriminator, 10);
	const ownerNumber = Number.isFinite(parsedDiscriminator)
		? String(parsedDiscriminator).padStart(2, '0')
		: user.discriminator;
	return `${user.displayName} ${ownerNumber}`;
}

export function formatLumePublicTagForStreamerMode(user: User): string {
	const tag = getLumePublicTag(user);
	return StreamerMode.shouldTruncateUsernames ? truncateStreamerModeName(tag) : tag;
}
