import mutators, { buildFormatterWithTooltip, booleanClassFor } from "../../../src/mixins/data_mutators"


describe("cellFormatter", () => {

  it("Should only render escaped html", () => {
    const input = {
      getValue: () => '<a>foo</a>',
      getElement: () => document.createElement('a'),
      getColumn: () => ({ getDefinition: () => ({ binaryEncoding: 'base64' }) }),
    }

    const formatted = mutators.methods.cellFormatter(input)

    expect(formatted).toBe('<pre>&lt;a&gt;foo&lt;/a&gt;</pre>')

  })

  it('tooltip render a unixtime', () => {
    const params = {
      formatterParams : {
        fk: false,
        fkOnClick: () => null,
        isPK: false
      }
    }
    const paramsHavePk = {
      formatterParams : {
        fk: false,
        fkOnClick: () => null,
        isPK: true
      }
    }

    const input = {
      getValue: () => '8640000000000000',
      getElement: () => document.createElement('a'),
      getColumn: () => ({ getDefinition: () => params }),
    }

    const inputPK = {
      getValue: () => '8640000000000000',
      getElement: () => document.createElement('a'),
      getColumn: () => ({ getDefinition: () => paramsHavePk}),
    }

    const badInput = {
      getValue: () => '8640000000000005',
      getElement: () => document.createElement('a'),
      getColumn: () => ({ getDefinition: () => params }),
    }

    expect(mutators.methods.cellTooltip(null, input)).toBe('8640000000000000 (+275760-09-13T00:00:00.000Z in unixtime)')
    expect(mutators.methods.cellTooltip(null, inputPK)).toBe('8640000000000000')
    expect(mutators.methods.cellTooltip(null, badInput)).toBe('8640000000000005')
  })

  it('render tooltip with escaped html', () => {
    const formatted = buildFormatterWithTooltip('<a>ne-er do-well</a>', '<a>ne-er do-well</a>', 'launch')

    const shouldBe = '<div class="cell-link-wrapper">&lt;a&gt;ne-er do-well&lt;/a&gt;<i class="material-icons fk-link" title="&lt;a&gt;ne-er do-well&lt;/a&gt;">launch</i></div>'

    expect(formatted).toBe(shouldBe)
  })

})

describe("booleanClassFor", () => {
  it("should colour real booleans", () => {
    expect(booleanClassFor('boolean', true)).toBe('boolean-true')
    expect(booleanClassFor('bool', false)).toBe('boolean-false')
    expect(booleanClassFor('BOOLEAN', true)).toBe('boolean-true')
  })

  // MySQL stores booleans as tinyint(1), so they arrive as 0/1
  it("should colour dialect-specific booleans", () => {
    expect(booleanClassFor('tinyint(1)', 1)).toBe('boolean-true')
    expect(booleanClassFor('tinyint(1)', 0)).toBe('boolean-false')
    expect(booleanClassFor('bit(1)', '1')).toBe('boolean-true')
  })

  // A plain int column holding 0/1 is ambiguous, so it stays uncoloured
  it("should ignore non-boolean columns", () => {
    expect(booleanClassFor('int4', 1)).toBe(null)
    expect(booleanClassFor('tinyint', 1)).toBe(null)
    expect(booleanClassFor('text', 'true')).toBe(null)
  })

  it("should ignore missing values", () => {
    expect(booleanClassFor('boolean', null)).toBe(null)
    expect(booleanClassFor('boolean', undefined)).toBe(null)
    expect(booleanClassFor(undefined, true)).toBe(null)
  })
})
