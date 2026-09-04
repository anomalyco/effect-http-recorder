#!/usr/bin/env bun
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { withPackedArchive } from "./pack.js"

const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json()
if (
  typeof pkg !== "object" ||
  pkg === null ||
  !("name" in pkg) ||
  typeof pkg.name !== "string" ||
  !("peerDependencies" in pkg) ||
  typeof pkg.peerDependencies !== "object" ||
  pkg.peerDependencies === null ||
  !("effect" in pkg.peerDependencies) ||
  typeof pkg.peerDependencies.effect !== "string" ||
  !("devDependencies" in pkg) ||
  typeof pkg.devDependencies !== "object" ||
  pkg.devDependencies === null ||
  !("typescript" in pkg.devDependencies) ||
  typeof pkg.devDependencies.typescript !== "string" ||
  !("@effect/platform-node-shared" in pkg.dependencies) ||
  typeof pkg.dependencies["@effect/platform-node-shared"] !== "string" ||
  !("@effect/platform-node" in pkg.devDependencies) ||
  typeof pkg.devDependencies["@effect/platform-node"] !== "string"
)
  throw new Error("Invalid package metadata")

const run = async (command: ReadonlyArray<string>, cwd: string) => {
  const process = Bun.spawn([...command], {
    cwd,
    env: globalThis.process.env,
    stdout: "inherit",
    stderr: "inherit",
  })
  const exitCode = await process.exited
  if (exitCode !== 0) throw new Error(`${command.join(" ")} exited with code ${exitCode}`)
}

const reject = async (command: ReadonlyArray<string>, cwd: string) => {
  const process = Bun.spawn([...command], { cwd, env: globalThis.process.env, stdout: "ignore", stderr: "ignore" })
  if ((await process.exited) === 0) throw new Error(`${command.join(" ")} unexpectedly succeeded`)
}

export const verifyPackage = async (archive: string) => {
  const directory = await mkdtemp(path.join(tmpdir(), "http-recorder-consumer-"))
  try {
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        name: "http-recorder-consumer",
        private: true,
        type: "module",
        overrides: {
          "@effect/platform-node": {
            "@effect/platform-node-shared": pkg.dependencies["@effect/platform-node-shared"],
          },
        },
      }),
    )
    await writeFile(
      path.join(directory, "consumer.ts"),
      `import { HttpRecorder } from ${JSON.stringify(pkg.name)}
import { NodeSocket } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpClient } from "effect/unstable/http"
import { Socket } from "effect/unstable/socket"

const options: HttpRecorder.RecorderOptions = { match: () => true, redact: { jsonFields: ["access_token"] } }
const socketOptions: HttpRecorder.SocketRecorderOptions = { redact: { jsonFields: ["access_token"] } }
HttpRecorder.layer("consumer", options) satisfies Layer.Layer<HttpClient.HttpClient, never, HttpClient.HttpClient>
HttpRecorder.layerFetch("consumer", options) satisfies Layer.Layer<HttpClient.HttpClient>
HttpRecorder.hasCassetteSync("consumer", { directory: "recordings" }) satisfies boolean
HttpRecorder.removeCassetteSync("consumer", { directory: "recordings" })
HttpRecorder.layerSocket("consumer/socket", socketOptions).pipe(
  Layer.provide(NodeSocket.layerWebSocket("wss://example.test")),
) satisfies Layer.Layer<Socket.Socket>
HttpRecorder.layerWebSocketConstructor("consumer/websocket", socketOptions).pipe(
  Layer.provide(NodeSocket.layerWebSocketConstructor),
) satisfies Layer.Layer<Socket.WebSocketConstructor>
// @ts-expect-error HTTP request matching does not apply to WebSocket frames.
HttpRecorder.layerSocket("consumer/socket", { match: () => true })
`,
    )
    await writeFile(
      path.join(directory, "exports.mjs"),
      `import { HttpRecorder } from ${JSON.stringify(pkg.name)}

const namespace = Object.keys(HttpRecorder).sort()
if (JSON.stringify(namespace) !== JSON.stringify(["hasCassetteSync", "layer", "layerFetch", "layerSocket", "layerWebSocketConstructor", "removeCassetteSync"])) {
  throw new Error(\`Unexpected HttpRecorder exports: \${namespace}\`)
}
`,
    )
    await writeFile(
      path.join(directory, "deep-import.mjs"),
      `import ${JSON.stringify(`${pkg.name}/http/recorder`)}
`,
    )
    await writeFile(
      path.join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          lib: ["ES2022", "DOM", "ESNext.Disposable"],
        },
        include: ["consumer.ts"],
      }),
    )

    await run(
      [
        "npm",
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
        archive,
        `typescript@${pkg.devDependencies.typescript}`,
        `effect@${pkg.peerDependencies.effect}`,
        `@effect/platform-node-shared@${pkg.dependencies["@effect/platform-node-shared"]}`,
        `@effect/platform-node@${pkg.devDependencies["@effect/platform-node"]}`,
      ],
      directory,
    )
    await run(["node", path.join(directory, "exports.mjs")], directory)
    await run(["bun", path.join(directory, "exports.mjs")], directory)
    await reject(["node", path.join(directory, "deep-import.mjs")], directory)
    await run(["npm", "ls", "effect", "@effect/platform-node-shared", "--all"], directory)
    await run([path.join(directory, "node_modules", ".bin", "tsc"), "--noEmit"], directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

if (import.meta.main) await withPackedArchive(verifyPackage)
