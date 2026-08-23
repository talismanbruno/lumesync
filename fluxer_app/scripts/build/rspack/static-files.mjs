// SPDX-License-Identifier: AGPL-3.0-or-later

import fs from 'node:fs';
import path from 'node:path';
import {sources} from '@rspack/core';

const FONT_LICENSE_FILES = [
	{source: 'NOTICE.md', asset: 'assets/fonts-NOTICE.txt'},
	{source: 'LICENSE-IBM-PLEX.txt', asset: 'assets/fonts-LICENSE-IBM-PLEX.txt'},
];

function generateManifest() {
	const manifest = {
		name: 'Lume',
		short_name: 'Lume',
		description: 'Lume é comunicação em tempo real para amigos, grupos e comunidades.',
		start_url: '/',
		display: 'standalone',
		orientation: 'portrait-primary',
		theme_color: '#00D1FF',
		background_color: '#050505',
		categories: ['social', 'communication'],
		lang: 'pt-BR',
		scope: '/',
		icons: [
			{
				src: '/assets/lume-favicon-v3.png',
				sizes: '192x192',
				type: 'image/png',
				purpose: 'any',
			},
			{
				src: '/assets/lume-favicon-v3.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any',
			},
			{
				src: '/assets/lume-favicon-v3.png',
				sizes: '180x180',
				type: 'image/png',
			},
			{
				src: '/assets/lume-favicon-v3.png',
				sizes: '32x32',
				type: 'image/png',
			},
			{
				src: '/assets/lume-favicon-v3.png',
				sizes: '16x16',
				type: 'image/png',
			},
		],
	};

	return JSON.stringify(manifest, null, 2);
}

function generateBrowserConfig() {
	return `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/assets/lume-favicon-v3.png"/>
      <TileColor>#050505</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;
}

function generateRobotsTxt() {
	return 'User-agent: *\nAllow: /\n';
}

export class StaticFilesPlugin {
	constructor(options = {}) {
		this.fontsDir = options.fontsDir;
		this.brandingLogoPath = options.brandingLogoPath;
	}

	emitFontLicenses(compilation) {
		if (!this.fontsDir) {
			return;
		}
		for (const {source, asset} of FONT_LICENSE_FILES) {
			const sourcePath = path.join(this.fontsDir, source);
			if (!fs.existsSync(sourcePath)) {
				throw new Error(
					`StaticFilesPlugin: ${sourcePath} is missing. The bundled fonts may not be redistributed without it.`,
				);
			}
			compilation.emitAsset(asset, new sources.RawSource(fs.readFileSync(sourcePath)));
		}
	}

	emitBrandingAssets(compilation) {
		if (!this.brandingLogoPath || !fs.existsSync(this.brandingLogoPath)) {
			throw new Error(`StaticFilesPlugin: Lume logo is missing at ${this.brandingLogoPath}.`);
		}
		compilation.emitAsset('lume/lume-logo.png', new sources.RawSource(fs.readFileSync(this.brandingLogoPath)));
		compilation.emitAsset('assets/lume-favicon-v3.png', new sources.RawSource(fs.readFileSync(this.brandingLogoPath)));
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap('StaticFilesPlugin', (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'StaticFilesPlugin',
					stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
				},
				() => {
					compilation.emitAsset('manifest.json', new sources.RawSource(generateManifest()));
					compilation.emitAsset('browserconfig.xml', new sources.RawSource(generateBrowserConfig()));
					compilation.emitAsset('robots.txt', new sources.RawSource(generateRobotsTxt()));
					this.emitFontLicenses(compilation);
					this.emitBrandingAssets(compilation);
				},
			);
		});
	}
}

export function staticFilesPlugin(options) {
	return new StaticFilesPlugin(options);
}
