import { vi, it, describe, expect, afterEach } from "vitest"
import { createNodeishMemoryFs } from "@lix-js/fs"
import { sleep } from "./sleep.js"
import type { Observer } from "./observables.js"
import { watchFs } from "./watchFs.js"
import * as rxjs from "rxjs"

import fs from "node:fs/promises"
import os from "node:os"
import process from "node:process"
import { join } from "node:path"

import _debug from "debug"
const debug = _debug("sdk:watchFs.test")

// temp dir for node fs tests
const tmpdir = join(os.tmpdir(), "test-sdk-watchFs")

afterEach(async () => {
  // cleanup temp dir carefully
  if (tmpdir.includes("test-sdk-watchFs")) {
    try {
      await fs.rm(tmpdir, { recursive: true })
    } catch (err) {
      // ignore
    }
  }
})

async function testEnvironments() {
  return [
    {
      envName: "node",
      nodeishFs: fs,
      baseDir: await fs.mkdtemp(tmpdir),
    },
    {
      envName: "memory",
      nodeishFs: createNodeishMemoryFs(),
      baseDir: "/test/project.inlang",
    },
  ]
}

describe.each(await testEnvironments())(
  "watchFs $envName",
  async ({ envName, nodeishFs, baseDir }) => {
    const waitForWatch = 100
    const isMemory = envName === "memory"

    // Only memoryFs has consistent event counts across OS flavors
    // so we only check for additional watch events, not for exact counts
    // And memoryFs watch seems to prefer forward slashes (not using join)
    // TODO: normalize paths for memoryFs

    const filename1 = "message.json"
    const filepath = isMemory ? baseDir + "/" + filename1 : join(baseDir, filename1)
    const dirname = "subdir"
    const dirpath = isMemory ? baseDir + "/" + dirname : join(baseDir, dirname)
    const filename2 = "foo.bar"
    const dirfilepath = isMemory ? dirpath + "/" + filename2 : join(dirpath, filename2)
    const dirfilename = isMemory ? dirname + "/" + filename2 : join(dirname, filename2)

    it(
      "emits events when files are touched",
      async () => {
        await nodeishFs.mkdir(baseDir, { recursive: true })

        const nextFn = vi.fn()
        const errorFn = vi.fn()
        const completeFn = vi.fn()

        const observer = {
          next: (v) => {
            debug("next", v)
            nextFn(v)
          },
          error: (err) => {
            debug("error", err)
            errorFn(err)
          },
          complete: () => {
            debug("complete")
            completeFn()
          },
        } satisfies Observer<string>

        const observable = watchFs({ nodeishFs, baseDir })
        const subscription = observable.subscribe(observer)

        let lastCallCount = nextFn.mock.calls.length

        async function checkForMoreCalls() {
          await sleep(waitForWatch)
          expect(nextFn.mock.calls.length).toBeGreaterThan(lastCallCount)
          lastCallCount = nextFn.mock.calls.length
        }

        async function checkForNoMoreCalls() {
          await sleep(waitForWatch)
          expect(nextFn).toHaveBeenCalledTimes(lastCallCount)
          expect(errorFn).not.toHaveBeenCalled()
        }

        await nodeishFs.writeFile(filepath, "{}")
        await checkForMoreCalls()
        expect(nextFn).toHaveBeenCalledWith(filename1)

        await nodeishFs.rm(filepath)
        await checkForMoreCalls()
        expect(nextFn).toHaveBeenCalledWith(filename1)

        await nodeishFs.mkdir(dirpath, { recursive: true })
        await checkForMoreCalls()
        expect(nextFn).toHaveBeenCalledWith(dirname)

        // node versions <20 do not support recursive watch under linux
        // https://github.com/nodejs/node/pull/45098#issuecomment-1891612491
        if (isMemory || parseInt(process.version.slice(1, 3)) >= 20) {
          await nodeishFs.writeFile(dirfilepath, "{}")
          await checkForMoreCalls()
          expect(nextFn).toHaveBeenCalledWith(dirfilename)
        }

        expect(completeFn).not.toHaveBeenCalled()
        subscription.unsubscribe()
        await checkForNoMoreCalls()
        expect(completeFn).not.toHaveBeenCalled()

        await nodeishFs.writeFile(filepath, "{}")
        await checkForNoMoreCalls()
      },
      { timeout: 500000 }
    )
    it(
      "works with RxJS",
      async () => {
        await nodeishFs.mkdir(baseDir, { recursive: true })

        const watcher = watchFs({ nodeishFs, baseDir }) as unknown as rxjs.ObservableInput<string>
        const unshared = rxjs.from(watcher)
        const shared = rxjs.from(watcher).pipe(rxjs.share())

        const subscription1 = unshared.subscribe((x) => debug("unshared subscription 1: ", x))
        const subscription2 = unshared.subscribe((x) => debug("unshared subscription 2: ", x))

        const subscription3 = shared.subscribe((x) => debug("shared subscription 3: ", x))
        const subscription4 = shared.subscribe((x) => debug("shared subscription 4: ", x))

        await nodeishFs.writeFile(filepath, "{}")
        await sleep(waitForWatch)

        subscription1.unsubscribe()
        subscription2.unsubscribe()
        subscription3.unsubscribe()
        subscription4.unsubscribe()
      },
      { timeout: 500000 }
    )
  }
)
