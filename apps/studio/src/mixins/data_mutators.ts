import _ from 'lodash'
import { Mutators } from '../lib/data/tools'
import { TabulatorFormatterParams } from '@/common/tabulator'
import helpers, { escapeHtml } from '@shared/lib/tabulator'
export const NULL = '(NULL)'
import {CellComponent} from 'tabulator-tables'

export function buildNullValue(text: string) {
  return `<span class="null-value">(${escapeHtml(text)})</span>`
}


export function emptyResult(value: any) {
  if (_.isNil(value)) {
    return buildNullValue('NULL')
  }
  if (_.isString(value) && _.isEmpty(value)) {
    return buildNullValue('EMPTY')
  }

  return null
}

/** Longer entries wrap into an unreadable block, so those stay as plain text. */
const MAX_PILL_LENGTH = 40

/**
 * Renders an array cell as one pill per element. Returns null when the value
 * isn't an array of short scalars, in which case the caller falls back to text.
 */
export function buildPills(value: unknown): string | null {
  const array = _.isArray(value) ? value : parseArrayLiteral(value)
  if (!array || array.length === 0) return null
  return buildPillsFromArray(array)
}

/**
 * Postgres hands back custom enum arrays as their raw literal -- `{a,b}` --
 * because pg has no registered parser for them, unlike built-in types such as
 * date[] which arrive already parsed. Decode the simple unquoted form so those
 * columns render like any other array.
 */
function parseArrayLiteral(value: unknown): string[] | null {
  if (!_.isString(value)) return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null

  const inner = trimmed.slice(1, -1)
  if (inner === '') return []
  // Quotes or escapes mean the literal needs real parsing, which belongs in the
  // driver rather than here -- fall back to showing the raw text.
  if (/["\\]/.test(inner)) return null

  return inner.split(',')
}

function buildPillsFromArray(value: unknown[]): string | null {

  const fits = value.every((v) =>
    (_.isString(v) || _.isNumber(v) || _.isBoolean(v)) &&
    String(v).length <= MAX_PILL_LENGTH
  )
  if (!fits) return null

  const pills = value
    .map((v) => `<span class="array-pill">${escapeHtml(String(v))}</span>`)
    .join('')
  return `<div class="array-pills">${pills}</div>`
}

export function buildFormatterWithTooltip(cellValue: string, tooltip: string, icon?: string) {
  if (!icon) {
    return `<div class="cell-link-wrapper" title="${escapeHtml(tooltip)}">${escapeHtml(cellValue)}</div>`
  }

  return `<div class="cell-link-wrapper">${escapeHtml(cellValue)}<i class="material-icons fk-link" title="${escapeHtml(tooltip)}">${escapeHtml(icon)}</i></div>`
}

export default {

  methods: {
    niceString: helpers.niceString,
    cellTooltip(
      _event,
      cell: CellComponent
    ) {
      const params: TabulatorFormatterParams = cell.getColumn().getDefinition().formatterParams || {}
      let cellValue = cell.getValue()

      if (cellValue instanceof Uint8Array) {
        const binaryEncoding = params.binaryEncoding || 'hex'
        cellValue = `${_.truncate(this.niceString(cellValue, false, binaryEncoding), { length: 15 })} (as ${binaryEncoding} string)`
      } else if (
        !params?.fk &&
        !params?.isPK &&
        _.isInteger(Number(cellValue))
      ) {
        try {
          cellValue += ` (${new Date(Number(cellValue)).toISOString()} in unixtime)`
        } catch (e) {
          console.error(`${cellValue} cannot be converted to a date`)
        }
      }
      
      const nullValue = emptyResult(cellValue)
      return nullValue ? nullValue : escapeHtml(this.niceString(cellValue, true))
    },
    cellFormatter(
      cell: CellComponent,
      params: { fk?: any[], isPK?: boolean, fkOnClick?: (e: MouseEvent, cell: CellComponent) => void, binaryEncoding?: string } = {},
      onRendered: (func: () => void) => void
    ) {
      const classNames = []
      let cellValue = cell.getValue()

      if (cellValue instanceof Uint8Array) {
        classNames.push('binary-type')
      }

      const nullValue = emptyResult(cellValue)
      if (nullValue) {
        return nullValue
      }

      // Arrays of short values read better as pills than as a JSON blob. Only
      // when there's no FK decoration to render, which owns the cell contents.
      if (!params?.fk) {
        const pills = buildPills(cellValue)
        if (pills) {
          cell.getElement().classList.add(...classNames)
          return pills
        }
      }

      cellValue = this.niceString(cellValue, true, params.binaryEncoding)
      cellValue = cellValue.replace(/\n/g, ' ↩ ');

      // removing the <pre> will break selection / copy paste, see ResultTable
      let result = `<pre>${escapeHtml(cellValue)}</pre>`
      let tooltip = ''

      if (params?.fk) {
        if (params.fk.length === 1) tooltip = `View record in ${params.fk[0].toTable}`
        else tooltip = `View records in ${(params.fk.map(item => item.toTable).join(', ') as string).replace(/, (?![\s\S]*, )/, ', or ')}`

        result = buildFormatterWithTooltip(cellValue, tooltip, 'launch')

        onRendered(() => {
          const fkLink = cell.getElement().querySelector('.fk-link') as HTMLElement
          fkLink.onclick = (e) => params.fkOnClick(e, cell);
        })
      }

      cell.getElement().classList.add(...classNames)

      return result;
    },
    yesNoFormatter: helpers.yesNoFormatter,
    ...Mutators
  }
}
