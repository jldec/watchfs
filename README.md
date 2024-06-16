# watchFs

Experimental test repo for https://github.com/opral/monorepo/pull/2913

- [watchFs.test.ts](watchFs.test.ts) - test for differences across environments
- [rxjs.test.ts](rxjs.test.ts) - test for rxjs behavior
- [watchFs.ts](watchFs.ts) - copy of inlang/source-code/sdk/src/persistence/watchFs.ts

## Findings

- node versions <20 do not support recursive watch under linux  
  https://github.com/nodejs/node/pull/45098#issuecomment-1891612491

- node watch event counts are not consistent across OS flavors  
  We only check for additional watch events, not for exact counts to make up for node inconsistencies.

- memoryFs watch seems to prefer forward slashes  
  Using path.join on windows for the watch path doesn't work.
  TODO: normalize paths for memoryFs.

- rsjs does not emit complete() after subscription.unsubscribe()  
