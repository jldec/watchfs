# watchFs

Temporary test repo for https://github.com/opral/monorepo/pull/2913
To investigating failure of directory watch on Linux and other inconsistencies
see [watchFs.test.ts](watchFs.test.ts)

- Only memoryFs emits consistent event counts across OS flavors so we only check for additional watch events, not for exact counts to make up for node inconsistencies.

- memoryFs watch seems to prefer forward slashes (not using join) TODO: normalize paths for memoryFs.

- node versions <20 do not support recursive watch under linux
	https://github.com/nodejs/node/pull/45098#issuecomment-1891612491