// Bundles the API into a single dist/main.js.
//
// The workspace packages (@qiro/db, @qiro/types, @qiro/game-engine) export raw
// TypeScript, which plain `tsc` output can't require at runtime — so they are
// compiled INTO the bundle. Real npm dependencies stay external (node_modules).
const path = require('node:path')
const nodeExternals = require('webpack-node-externals')

module.exports = (options) => ({
  ...options,
  resolve: {
    ...options.resolve,
    // Workspace packages use ESM-style './x.js' specifiers that point at './x.ts'
    extensionAlias: { '.js': ['.ts', '.js'] },
  },
  externals: [
    nodeExternals({
      allowlist: [/^@qiro\//],
      modulesDir: path.resolve(__dirname, 'node_modules'),
    }),
    // Prisma's generated client finds its query engine via __dirname, so it must be
    // loaded from its real location rather than bundled.
    ({ request, context }, callback) => {
      if (request && /[\\/]generated[\\/]client$/.test(request)) {
        const target = path.resolve(context, request)
        const fromDist = path.relative(path.resolve(__dirname, 'dist'), target).split(path.sep).join('/')
        return callback(null, `commonjs ${fromDist}`)
      }
      callback()
    },
  ],
})
