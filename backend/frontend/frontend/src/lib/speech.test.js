import { describe, expect, it } from 'vitest'
import { isThinkingPause, splitSentences } from './speech'

describe('isThinkingPause', () => {
  it('detects trailing fillers and hesitations', () => {
    expect(isThinkingPause('I would say um')).toBe(true)
    expect(isThinkingPause('let me think')).toBe(true)
    expect(isThinkingPause('the answer is X because')).toBe(true)
    expect(isThinkingPause('hold on,')).toBe(true)
  })

  it('does not flag a finished thought', () => {
    expect(isThinkingPause('I optimized the query with an index.')).toBe(false)
  })

  it('handles empty input', () => {
    expect(isThinkingPause('')).toBe(false)
    expect(isThinkingPause(null)).toBe(false)
  })
})

describe('splitSentences', () => {
  it('splits on sentence terminators, keeping them attached', () => {
    expect(splitSentences('Hello there. How are you? Great!')).toEqual([
      'Hello there.',
      'How are you?',
      'Great!',
    ])
  })

  it('does not split on common abbreviations', () => {
    expect(splitSentences('Talk to Dr. Smith about e.g. caching. Then report back.')).toEqual([
      'Talk to Dr. Smith about e.g. caching.',
      'Then report back.',
    ])
  })

  it('does not split decimals', () => {
    expect(splitSentences('Latency dropped to 1.5 seconds. Nice work.')).toEqual([
      'Latency dropped to 1.5 seconds.',
      'Nice work.',
    ])
  })

  it('keeps a trailing fragment without a terminator', () => {
    expect(splitSentences('First point. And one more thing')).toEqual([
      'First point.',
      'And one more thing',
    ])
  })

  it('returns empty for blank input', () => {
    expect(splitSentences('')).toEqual([])
    expect(splitSentences('   ')).toEqual([])
  })
})
