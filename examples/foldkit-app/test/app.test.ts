// One suite runs against the VibeLang app and its Effect TypeScript original.
import { Effect, Layer } from "effect"
import { HttpClient, HttpClientResponse } from "effect/http"
import { Command, given, message, model, story } from "foldkit/story"
import { describe, expect, test } from "vitest"
import * as Vibe from "../src/main.vibe"
import * as Original from "../ts/main.ts"

// An HttpClient that answers every request with one JSON body, without a socket.
const respondWith = (body: unknown) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(request =>
      Effect.succeed(HttpClientResponse.fromWeb(request, new Response(JSON.stringify(body), { status: 200 })))
    )
  )

const initial = { count: 0, draft: "", todos: [], quote: "" }

describe.each([
  ["VibeLang", Vibe as unknown as typeof Original],
  ["Effect TypeScript", Original]
])("%s", (_, app) => {
  const { Message, update } = app

  test("counts up and down", () => {
    story(
      update,
      given(initial),
      message(Message.ClickedIncrement()),
      message(Message.ClickedIncrement()),
      message(Message.ClickedDecrement()),
      Command.expectNone(),
      model(model => expect(model.count).toBe(1))
    )
  })

  test("adds a trimmed todo, ignores a blank one and toggles it", () => {
    story(
      update,
      given(initial),
      message(Message.UpdatedDraft({ value: "  milk " })),
      message(Message.SubmittedTodo()),
      message(Message.UpdatedDraft({ value: "   " })),
      message(Message.SubmittedTodo()),
      message(Message.ToggledTodo({ id: 1 })),
      model(model => expect(model.todos).toEqual([{ id: 1, text: "milk", done: true }]))
    )
  })

  test("a quote request issues FetchQuote and shows its result", () => {
    story(
      update,
      given(initial),
      message(Message.ClickedFetchQuote()),
      model(model => expect(model.quote).toBe("Loading...")),
      Command.resolve(app.FetchQuote, Message.SucceededFetchQuote({ text: "Fold left." })),
      model(model => expect(model.quote).toBe("Fold left."))
    )
  })

  test("fetchQuote decodes the response into SucceededFetchQuote", async () => {
    const result = await Effect.runPromise(Effect.provide(app.fetchQuote(), respondWith({ text: "Fold left." })))
    expect(result).toEqual(Message.SucceededFetchQuote({ text: "Fold left." }))
  })

  test("fetchQuote turns a malformed response into FailedFetchQuote", async () => {
    const result = await Effect.runPromise(Effect.provide(app.fetchQuote(), respondWith({ quote: 1 })))
    expect(result).toEqual(Message.FailedFetchQuote({ error: "Could not load a quote" }))
  })
})
