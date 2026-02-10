import type { KeyIssue } from '../types'

const FORBIDDEN_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'null',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while',
  'as', 'fun', 'in', 'is', 'object', 'typealias', 'typeof', 'val', 'var',
  'when', 'companion', 'data', 'sealed', 'internal', 'open', 'lateinit',
  'inline', 'crossinline', 'noinline', 'reified', 'suspend', 'tailrec',
  'vararg', 'where', 'it', 'out', 'dynamic', 'actual', 'expect',
  'let', 'func', 'self', 'true', 'false', 'nil', 'inout', 'init', 'deinit',
  'subscript', 'convenience', 'required', 'override', 'mutating', 'lazy',
  'weak', 'unowned', 'optional', 'prefix', 'postfix', 'infix', 'operator',
  'fileprivate', 'rethrows', 'repeat', 'guard', 'defer', 'fallthrough',
  'associatedtype', 'protocol', 'struct', 'extension', 'indirect', 'get', 'set',
  'willset', 'didset', 'any', 'some',
  'auto', 'register', 'extern', 'union', 'signed', 'unsigned', 'sizeof', 'typedef',
  'id', 'string', 'layout', 'color', 'style', 'drawable', 'menu', 'raw', 'xml',
  'mipmap', 'name', 'anim', 'animator', 'array', 'attr', 'bool', 'dimen',
  'fraction', 'integer', 'interpolator', 'plurals', 'values', 'font', 'unit',
  'type', 'value', 'key', 'index', 'item', 'list', 'map', 'result', 'error',
])

export function optimizeKey(key: string): { optimized: string; wasChanged: boolean } {
  let result = key
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!result || /^[0-9]/.test(result)) {
    result = 'fix_' + result
  }

  if (FORBIDDEN_KEYWORDS.has(result)) {
    result = 'common_fix_' + result
  }

  return { optimized: result, wasChanged: key !== result }
}

export function analyzeKeyIssues(keyPath: string): KeyIssue | null {
  const segments = keyPath.split('.')
  const lastSegment = segments[segments.length - 1]
  const { optimized, wasChanged } = optimizeKey(lastSegment)

  if (!wasChanged) return null

  const fixedSegments = [...segments.slice(0, -1), optimized]
  return {
    original: lastSegment,
    suggested: optimized,
    keyPath: fixedSegments.join('.'),
  }
}
