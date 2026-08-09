import { describe, expect, it } from 'vitest'
import { toSlug } from '../../src/utils/slug'
describe('toSlug', () => { it('normaliza nome do organizador', () => expect(toSlug('Associação São João  2026')).toBe('associacao-sao-joao-2026')); it('remove pontuação das bordas', () => expect(toSlug(' -- Bingo Central -- ')).toBe('bingo-central')) })
