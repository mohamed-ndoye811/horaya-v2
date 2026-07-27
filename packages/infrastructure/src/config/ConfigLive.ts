import { Context, Layer, Effect, Config as EffectConfig } from "effect"

export class AppConfig extends Context.Tag("AppConfig")<
  AppConfig,
  { readonly databaseUrl: string }
>() {}

export const ConfigLive = Layer.effect(
  AppConfig,
  Effect.gen(function* () {
    const databaseUrl = yield* EffectConfig.string("DATABASE_URL")
    return { databaseUrl }
  })
)