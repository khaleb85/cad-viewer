#!/usr/bin/env node
// One-shot: enriches web/public/fonts/fonts.json with case/extension aliases
// for each entry. Asian fonts that already have rich aliases are preserved.
//
// Usage from cad-viewer/:
//   node tools/expand-font-aliases.mjs ../web/public/fonts/fonts.json
//
// Writes the file back in place. Run again whenever a new font is added.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const path = resolve(process.argv[2] ?? '../web/public/fonts/fonts.json')
const src = JSON.parse(readFileSync(path, 'utf8'))

function expand(originalNames, file) {
  const ext = (file.split('.').pop() ?? '').toLowerCase()
  const out = new Set()
  for (const original of originalNames) {
    out.add(original)
    const lower = original.toLowerCase()
    const upper = original.toUpperCase()
    out.add(lower)
    out.add(upper)
    out.add(`${lower}.${ext}`)
    out.add(`${upper}.${ext.toUpperCase()}`)
    if (ext !== 'shx') {
      // mesh fonts: add .ttf alias (some DWGs reference Arial as arial.ttf)
      out.add(`${lower}.ttf`)
      out.add(`${upper}.TTF`)
    }
  }
  return [...out]
}

const enriched = src.map(entry => ({
  ...entry,
  name: expand(entry.name, entry.file)
}))

writeFileSync(path, JSON.stringify(enriched, null, 2) + '\n', 'utf8')
console.log(`Wrote ${enriched.length} entries to ${path}`)
