import { drawerModeFor } from "@/mixins/cell_editor_drawer"

describe("drawerModeFor", () => {
  it("should open json columns in json mode", () => {
    expect(drawerModeFor('json')).toBe('json')
    expect(drawerModeFor('jsonb')).toBe('json')
    expect(drawerModeFor('JSONB')).toBe('json')
  })

  it("should open large text columns in text mode", () => {
    expect(drawerModeFor('text')).toBe('text')
    expect(drawerModeFor('TEXT')).toBe('text')
    expect(drawerModeFor('tsvector')).toBe('text')
  })

  // Short values are fine in the inline editor -- only types that were
  // previously forced into a cramped textarea move to the drawer.
  it("should leave other columns editing inline", () => {
    expect(drawerModeFor('varchar(255)')).toBe(null)
    expect(drawerModeFor('int4')).toBe(null)
    expect(drawerModeFor('bool')).toBe(null)
    expect(drawerModeFor('timestamp with time zone')).toBe(null)
  })

  // dataType is absent for query results that aren't backed by a table
  it("should handle a missing data type", () => {
    expect(drawerModeFor(undefined)).toBe(null)
    expect(drawerModeFor(null)).toBe(null)
    expect(drawerModeFor('')).toBe(null)
  })
})

describe("drawerModeFor with arrays", () => {
  // Postgres names array types with a leading underscore: _date is date[]
  it("should open array columns in json mode", () => {
    expect(drawerModeFor('_date')).toBe('json')
    expect(drawerModeFor('_text')).toBe('json')
    expect(drawerModeFor('_int4')).toBe('json')
  })

  it("should honour an explicit array flag", () => {
    expect(drawerModeFor('date', { array: true })).toBe('json')
    expect(drawerModeFor('varchar', { array: true })).toBe('json')
  })

  it("should not treat scalars as arrays", () => {
    expect(drawerModeFor('date')).toBe(null)
    expect(drawerModeFor('date', { array: false })).toBe(null)
  })
})
