import { Effect, Schema } from "effect"
import { HttpClient } from "effect/http"
import { Command, Http, Runtime, type Update } from "foldkit"
import { Document, HtmlBuilder } from "foldkit/html"
import { defineMessageUnion } from "foldkit/message"

// MODEL

export const Todo = Schema.Struct({ id: Schema.Number, text: Schema.String, done: Schema.Boolean })
export type Todo = typeof Todo.Type

export const Model = Schema.Struct({
  count: Schema.Number,
  draft: Schema.String,
  todos: Schema.Array(Todo),
  quote: Schema.String
})
export type Model = typeof Model.Type

// MESSAGE

export const Message = defineMessageUnion({
  ClickedIncrement: {},
  ClickedDecrement: {},
  UpdatedDraft: { value: Schema.String },
  SubmittedTodo: {},
  ToggledTodo: { id: Schema.Number },
  ClickedFetchQuote: {},
  SucceededFetchQuote: { text: Schema.String },
  FailedFetchQuote: { error: Schema.String }
})
export type Message = typeof Message.Type

// COMMAND

export const QUOTE_URL = "https://example.com/quote.json"
const Quote = Schema.Struct({ text: Schema.String })

export const fetchQuote = () =>
  Effect.gen(function* () {
  const response = yield* HttpClient.get(QUOTE_URL)
  const quote = yield* Schema.decodeUnknownEffect(Quote)(yield* response.json)
  return Message.SucceededFetchQuote({ text: quote.text })
}).pipe(
  Effect.catch(() => Effect.succeed(Message.FailedFetchQuote({ error: "Could not load a quote" })))
)

export const FetchQuote = Command.define("FetchQuote", {
  args: {},
  messages: [Message.SucceededFetchQuote, Message.FailedFetchQuote],
  execute: () => Effect.provide(fetchQuote(), Http.layer)
})

// UPDATE

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedIncrement: () => ({ model: { ...model, count: model.count + 1 } }),
    ClickedDecrement: () => ({ model: { ...model, count: model.count - 1 } }),
    UpdatedDraft: ({ value }) => ({ model: { ...model, draft: value } }),
    SubmittedTodo: () => {
      const text = model.draft.trim()
      if (text === "") return { model }
      const todo = { id: model.todos.length + 1, text, done: false }
      return { model: { ...model, draft: "", todos: [...model.todos, todo] } }
    },
    ToggledTodo: ({ id }) => ({
      model: { ...model, todos: model.todos.map(todo => (todo.id === id ? { ...todo, done: !todo.done } : todo)) }
    }),
    ClickedFetchQuote: () => ({ model: { ...model, quote: "Loading..." }, commands: [FetchQuote({})] }),
    SucceededFetchQuote: ({ text }) => ({ model: { ...model, quote: text } }),
    FailedFetchQuote: ({ error }) => ({ model: { ...model, quote: error } })
  })

// INIT

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: { count: 0, draft: "", todos: [], quote: "" }
})

// VIEW

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: `Counter: ${model.count}`,
  body: h.main([], [
    h.p([], [String(model.count)]),
    h.button([h.OnClick(Message.ClickedDecrement())], ["-"]),
    h.button([h.OnClick(Message.ClickedIncrement())], ["+"]),
    h.form([h.OnSubmit(Message.SubmittedTodo())], [
      h.input([h.Value(model.draft), h.OnInput(value => Message.UpdatedDraft({ value }))]),
      h.button([], ["Add"])
    ]),
    h.ul([], model.todos.map(todo =>
      h.li([h.OnClick(Message.ToggledTodo({ id: todo.id }))], [todo.done ? `✓ ${todo.text}` : todo.text])
    )),
    h.button([h.OnClick(Message.ClickedFetchQuote())], ["Quote"]),
    h.p([], [model.quote])
  ])
})
