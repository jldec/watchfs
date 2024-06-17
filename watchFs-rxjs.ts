import type { NodeishFilesystem } from "@lix-js/fs"
import { Observable } from "rxjs"
import _debug from "debug"
const debug = _debug("sdk:watchFs-rxjs")

/**
 * returns an observable that emits relative paths as they change below a base directory
 * lix FileChangeInfo eventType is always 'rename' on macOS - no point is using it
 * see lix/packages/fs/src/NodeishFilesystemApi.ts
 * https://github.com/nodejs/node/issues/7420
 *
 * subscribers each get their own fs.watch
 */
export function watchFs(args: {
  nodeishFs: NodeishFilesystem
  baseDir: string
}): Observable<string> {
  return new Observable(function subscribe(observer) {
    debug(args.baseDir, "subscribe")
    const abortController = new AbortController()

    startWatching()
      .then(() => {
        observer.complete()
        debug(args.baseDir, "complete")
      })
      .catch((err: any) => {
        if (err.name === "AbortError") {
          observer.complete()
          debug(args.baseDir, "complete")
        } else {
          observer.error(err)
          debug(args.baseDir, `error`, err)
        }
      })

    return function unsubscribe() {
      debug(args.baseDir, "unsubscribe")
      abortController.abort()
    }

    async function startWatching() {
      const watcher = args.nodeishFs.watch(args.baseDir, {
        recursive: true,
        signal: abortController.signal,
      })
      for await (const event of watcher) {
        if (event.filename) {
          debug(args.baseDir, "=>", event.filename)
          observer.next(event.filename)
        }
      }
    }
  })
}
