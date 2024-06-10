import { vi, it, describe, expect, afterEach } from "vitest"
import { createNodeishMemoryFs } from "@lix-js/fs"
import { sleep } from "./sleep.js"
import type { Observer } from "./observables.js"
import { watchFs } from "./watchFs.js"

import fs from "node:fs/promises"
import os from "node:os"
import process from "node:process"
import { join } from "node:path"

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
		it(
			"emits events when files are touched",
			async () => {
				await nodeishFs.mkdir(baseDir, { recursive: true })

				const observer = {
					next: vi.fn(),
					error: vi.fn(),
					complete: vi.fn(),
				} satisfies Observer<string>

				const observable = watchFs({ nodeishFs, baseDir })
				const subscription = observable.subscribe(observer)

				await nodeishFs.writeFile(join(baseDir, "/messages.json"), "{}")
				await sleep(waitForWatch)

				// only memoryFs has consistent event counts across different OS
				if (envName === "memory") {
					expect(observer.next).toHaveBeenCalledTimes(1)
				}
				expect(observer.next).toHaveBeenCalledWith("messages.json")

				await nodeishFs.rm(join(baseDir, "messages.json"))
				await sleep(waitForWatch)

				if (envName === "memory") {
					expect(observer.next).toHaveBeenCalledTimes(2)
				}
				expect(observer.next).toHaveBeenCalledWith("messages.json")

				await nodeishFs.mkdir(join(baseDir, "subdir"), { recursive: true })
				await sleep(waitForWatch)

				if (envName === "memory") {
					expect(observer.next).toHaveBeenCalledTimes(3)
				}
				expect(observer.next).toHaveBeenCalledWith("subdir")

				await nodeishFs.writeFile(join(baseDir, "subdir/foo.bar"), "{}")
				await sleep(waitForWatch)

				if (envName === "memory") {
					expect(observer.next).toHaveBeenCalledTimes(4)
				}

				// node versions <20 do not support recursive watch
				// https://github.com/nodejs/node/pull/45098#issuecomment-1891612491
				if (envName === "memory" || parseInt(process.version.slice(1, 3)) >= 20) {
					expect(observer.next).toHaveBeenCalledWith("subdir/foo.bar")
				}
				const nextCallCount = observer.next.mock.calls.length

				// should complete without more events
				subscription.unsubscribe()
				await sleep(waitForWatch)

				expect(observer.next).toHaveBeenCalledTimes(nextCallCount)
				expect(observer.error).not.toHaveBeenCalled()
				expect(observer.complete).toHaveBeenCalledTimes(1)

				// should not emit any more events
				await nodeishFs.writeFile(join(baseDir, "messages.json"), "{}")
				await sleep(waitForWatch)

				expect(observer.next).toHaveBeenCalledTimes(nextCallCount)
				expect(observer.error).not.toHaveBeenCalled()
				expect(observer.complete).toHaveBeenCalledTimes(1)
			},
			{ timeout: 5000 }
		)
	}
)
