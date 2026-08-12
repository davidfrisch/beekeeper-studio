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

/**
 * A stable hue for an enum value, so each member of an enum is visually
 * distinct and always renders the same colour. Seeded with the column too, so
 * neighbouring values within one column spread out rather than depending on
 * how the words happen to hash.
 *
 * Only the hue varies -- saturation and lightness are fixed by the theme, so
 * every value keeps a readable contrast instead of landing wherever the hash
 * points.
 */
export function enumColorFor(value: string, seed = ""): string {
  let hash = 0
  const input = `${seed}:${value}`
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} var(--enum-value-saturation, 70%) var(--enum-value-lightness, 70%))`
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
    pillFormatter(cell: CellComponent) {
      const nullValue = emptyResult(cell.getValue())
      if (nullValue) {
        return ''
      }

      const cellValue = cell.getValue()
      return cellValue.map(cv => `<span class="mapper-pill">${cv}</span>`).join('')
    },
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
      cellValue = this.niceString(cellValue, true, params.binaryEncoding)
      cellValue = cellValue.replace(/\n/g, ' ↩ ');

      // Enum members get a stable colour each, so a column of statuses is
      // scannable. Skipped for FK cells, which own their own rendering.
      const definition = cell.getColumn().getDefinition()
      const enumValues: string[] | undefined = definition.enumValues
      const isEnumMember = !params?.fk && enumValues?.includes(cellValue)
      const enumStyle = isEnumMember
        ? ` style="color:${enumColorFor(cellValue, definition.field || "")}"`
        : ""

      // removing the <pre> will break selection / copy paste, see ResultTable
      let result = `<pre${enumStyle}>${escapeHtml(cellValue)}</pre>`
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
