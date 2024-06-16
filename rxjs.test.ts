import { describe, it, expect, vi } from "vitest"
import { Observable } from "rxjs"
import { sleep } from "./sleep.js"

describe("rxjs observable", () => {
  it("does not emit complete after unsubscribe", async () => {
    const nextFn = vi.fn()
    const errorFn = vi.fn()
    const completeFn = vi.fn()

    const observer = {
      next: (v: string) => {
        console.log("next", v)
        nextFn(v)
      },
      error: (err: Error) => {
        console.log("error", err)
        errorFn(err)
      },
      complete: () => {
        console.log("complete")
        completeFn()
      },
    }

    const observable = new Observable<string>((observer) => {
      observer.next("a")
      observer.next("b")
      observer.next("c")
      setTimeout(() => {
        observer.next("d")
        observer.complete()
      }, 10)
    })

    const subscription = observable.subscribe(observer)

    expect(nextFn.mock.calls).toEqual([["a"], ["b"], ["c"]])
    expect(completeFn).not.toHaveBeenCalled()
    subscription.unsubscribe()
    await sleep(100)
    expect(completeFn).not.toHaveBeenCalled()
    await sleep(100)
    expect(completeFn).not.toHaveBeenCalled()
  })
})
