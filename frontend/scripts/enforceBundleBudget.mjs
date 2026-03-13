#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

function fail(message) {
  console.error(`[bundle-budget] ${message}`)
  process.exit(1)
}

function formatBytes(value) {
  return new Intl.NumberFormat('en-US').format(value)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fail(`Unable to parse JSON at ${path}: ${message}`)
  }
}

function requiredNumber(value, keyPath) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    fail(`Expected "${keyPath}" to be a positive number.`)
  }
  return value
}

function listFilesRecursively(rootPath) {
  const queue = [rootPath]
  const files = []
  while (queue.length) {
    const nextPath = queue.pop()
    if (!nextPath) continue
    for (const name of readdirSync(nextPath)) {
      const absolutePath = join(nextPath, name)
      const stat = statSync(absolutePath)
      if (stat.isDirectory()) {
        queue.push(absolutePath)
      } else if (stat.isFile()) {
        files.push({
          name,
          path: absolutePath,
          size: stat.size,
        })
      }
    }
  }
  return files
}

const frontendRoot = process.cwd()
const assetsDir = resolve(frontendRoot, 'dist/assets')
const configPath = resolve(frontendRoot, 'bundle-budget.json')

if (!existsSync(configPath)) {
  fail(`Missing bundle budget configuration file: ${configPath}`)
}
if (!existsSync(assetsDir)) {
  fail(`Missing build assets directory: ${assetsDir}. Run "npm run build" first.`)
}

const config = readJson(configPath)
if (!config || typeof config !== 'object') {
  fail('Bundle budget configuration must be a JSON object.')
}

const budgets = config.budgets
if (!budgets || typeof budgets !== 'object') {
  fail('Bundle budget configuration must include a "budgets" object.')
}

const maxTotalAssetBytes = requiredNumber(budgets.max_total_asset_bytes, 'budgets.max_total_asset_bytes')
const maxTotalJsBytes = requiredNumber(budgets.max_total_js_bytes, 'budgets.max_total_js_bytes')
const maxTotalCssBytes = requiredNumber(budgets.max_total_css_bytes, 'budgets.max_total_css_bytes')
const maxLargestAssetBytes = requiredNumber(budgets.max_largest_asset_bytes, 'budgets.max_largest_asset_bytes')

const maxChunkBytes = config.max_chunk_js_bytes
if (!maxChunkBytes || typeof maxChunkBytes !== 'object') {
  fail('Bundle budget configuration must include a "max_chunk_js_bytes" object.')
}

const files = listFilesRecursively(assetsDir)
if (!files.length) {
  fail(`No built assets found under ${assetsDir}.`)
}

const jsFiles = files.filter((file) => file.name.endsWith('.js'))
const cssFiles = files.filter((file) => file.name.endsWith('.css'))

const totalAssetBytes = files.reduce((sum, file) => sum + file.size, 0)
const totalJsBytes = jsFiles.reduce((sum, file) => sum + file.size, 0)
const totalCssBytes = cssFiles.reduce((sum, file) => sum + file.size, 0)
const largestAsset = files.reduce((largest, file) => (file.size > largest.size ? file : largest))

const violations = []

if (totalAssetBytes > maxTotalAssetBytes) {
  violations.push(
    `total assets ${formatBytes(totalAssetBytes)} exceeds budget ${formatBytes(maxTotalAssetBytes)} bytes`
  )
}
if (totalJsBytes > maxTotalJsBytes) {
  violations.push(
    `total JS ${formatBytes(totalJsBytes)} exceeds budget ${formatBytes(maxTotalJsBytes)} bytes`
  )
}
if (totalCssBytes > maxTotalCssBytes) {
  violations.push(
    `total CSS ${formatBytes(totalCssBytes)} exceeds budget ${formatBytes(maxTotalCssBytes)} bytes`
  )
}
if (largestAsset.size > maxLargestAssetBytes) {
  violations.push(
    `largest asset ${largestAsset.name} (${formatBytes(largestAsset.size)}) exceeds budget ${formatBytes(maxLargestAssetBytes)} bytes`
  )
}

for (const [chunkName, rawBudget] of Object.entries(maxChunkBytes)) {
  const budget = requiredNumber(rawBudget, `max_chunk_js_bytes.${chunkName}`)
  const chunkFile = jsFiles.find((file) => file.name.startsWith(`${chunkName}-`))
  if (!chunkFile) {
    violations.push(`missing expected JS chunk for budget key "${chunkName}"`)
    continue
  }
  if (chunkFile.size > budget) {
    violations.push(
      `chunk ${chunkFile.name} (${formatBytes(chunkFile.size)}) exceeds budget ${formatBytes(budget)} bytes`
    )
  }
}

if (violations.length) {
  for (const violation of violations) {
    console.error(`[bundle-budget] ${violation}`)
  }
  process.exit(1)
}

console.log(
  `[bundle-budget] OK totalAssets=${formatBytes(totalAssetBytes)} totalJs=${formatBytes(totalJsBytes)} totalCss=${formatBytes(totalCssBytes)} largest=${largestAsset.name}:${formatBytes(largestAsset.size)}`
)
