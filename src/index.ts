const RE_MEDIA_QUERY =
  /^(?:(only|not)?\s*([_a-z][\w-]*)|(\([^)]+\)))(?:\s*and\s*(.*))?$/i
const RE_MQ_EXPRESSION = /^\(\s*([_a-z-][\d_a-z-]*)\s*(?::\s*([^)]+))?\s*\)$/
const RE_MQ_FEATURE = /^(?:-(webkit|moz|o)-)?(?:(min|max)-)?(?:-(moz)-)?(.+)/
const RE_LENGTH_UNIT = /(em|rem|px|cm|mm|in|pt|pc)?\s*$/
const RE_RESOLUTION_UNIT = /(dpi|dpcm|dppx)?\s*$/
const RE_COMMENTS = /\/\*[^*]*\*+([^/][^*]*\*+)*\//gi

export interface MediaValues {
  orientation: "portrait" | "landscape"
  width: string | number
  height: string | number
  "device-width": string | number
  "device-height": string | number
  resolution: string | number
  "aspect-ratio": string | number
  "device-aspect-ratio": string | number
  "device-pixel-ratio": string | number
  grid: 0 | 1
  color: number
  "color-gamut": "srgb" | "p3" | "rec2020"
  "color-index": number
  monochrome: number
  "prefers-color-scheme": "light" | "dark"
  "prefers-contrast": "no-preference" | "more" | "less" | "custom"
  "prefers-reduced-motion": "no-preference" | "reduce"
  "forced-colors": "none" | "active"
  "inverted-colors": "none" | "inverted"
  hover: "none" | "hover"
  pointer: "none" | "coarse" | "fine"
  "any-hover": "none" | "hover"
  "any-pointer": "none" | "coarse" | "fine"
  type: string
}

interface Expression {
  modifier?: "min" | "max"
  feature: keyof MediaValues
  value: string
}

interface QueryNode {
  inverse: boolean
  type: string
  expressions: Expression[]
}

export type AST = QueryNode[]

export const remBase = 16

const toString = (string: string | number) => string.toString().toLowerCase()

const toFloat = (string: string | number) => Number.parseFloat(toString(string))

const toDecimal = (ratio: string | number) =>
  Number(
    toString(ratio).replace(
      /^(\d+)\s*\/\s*(\d+)$/,
      (_, a, b) => (a / b) as any,
    ),
  )

const toDpi = (resolution: string | number) => {
  const value = toFloat(resolution)
  const units = RE_RESOLUTION_UNIT.exec(toString(resolution))![1]

  switch (units) {
    case "dpcm": {
      return value / 2.54
    }
    case "dppx": {
      return value * 96
    }
    default: {
      return value
    }
  }
}

const toPx = (length: string | number) => {
  const value = toFloat(length)
  const units = RE_LENGTH_UNIT.exec(toString(length))![1]

  switch (units) {
    case "em": {
      return value * remBase
    }
    case "rem": {
      return value * remBase
    }
    case "cm": {
      return (value * 96) / 2.54
    }
    case "mm": {
      return (value * 96) / 2.54 / 10
    }
    case "in": {
      return value * 96
    }
    case "pt": {
      return value * 72
    }
    case "pc": {
      return (value * 72) / 12
    }
    default: {
      return value
    }
  }
}

const cache: Record<string, AST> = {}

/**
 * Parses a Media Query expression and returns an AST.
 * @example
 *   const ast = parse('screen and (min-width: 48em)');
 *   // Returns
 *   [
 *     {
 *       inverse: false,
 *       type: 'screen',
 *       expressions: [
 *         {
 *           modifier: 'min',
 *           feature: 'width',
 *           value: '48em',
 *         },
 *       ],
 *     },
 *   ];
 */
export function parse(query: string): AST {
  if (cache[query]) {
    return cache[query]
  }

  const ast = query.split(",").map((query) => {
    // Remove comments first
    query = query.replace(RE_COMMENTS, "").trim()

    const captures = RE_MEDIA_QUERY.exec(query)

    // Media Query must be valid
    if (!captures) {
      throw new SyntaxError(`Invalid CSS media query: "${query}"`)
    }

    const modifier = captures[1]
    const type = captures[2]
    let expressions: string | string[] | null = (
      (captures[3] || "") + (captures[4] || "")
    ).trim()
    const parsed: QueryNode = {
      inverse: !!modifier && toString(modifier) === "not",
      type: type ? toString(type) : "all",
      expressions: [],
    }

    // Check for Media Query expressions
    if (!expressions) {
      return parsed
    }

    // Split expressions into a list
    expressions = expressions.match(/\([^)]+\)/g)

    // Media Query must be valid
    if (!expressions) {
      throw new SyntaxError(`Invalid CSS media query: "${query}"`)
    }

    parsed.expressions = expressions.map((expression) => {
      const captures = RE_MQ_EXPRESSION.exec(expression)

      // Media Query must be valid
      if (!captures) {
        throw new SyntaxError(`Invalid CSS media query: "${query}"`)
      }

      const feature = RE_MQ_FEATURE.exec(toString(captures[1]))!

      return {
        modifier: feature[2],
        feature: feature[4],
        value: captures[2],
      } as Expression
    })

    return parsed
  })

  cache[query] = ast
  return ast
}

/**
 * Lets you compare a Media Query expression with a JavaScript object and
 * determine if a Media Query matches the given set of values.
 */
export function match(
  query: string | AST,
  values: Partial<MediaValues>,
): boolean {
  const ast = typeof query === "string" ? parse(query) : query

  return ast.some((node) => {
    const { expressions, inverse, type } = node

    // Either the parsed or specified `type` is "all", or the types must be
    // equal for a match
    const typeMatch = type === "all" || values.type === type

    // Quit early when `type` doesn't match, but take "not" into account
    if ((typeMatch && inverse) || !(typeMatch || inverse)) {
      return false
    }

    const expressionsMatch = expressions.every((expression) => {
      const { feature, modifier } = expression
      let expValue: string | number = expression.value
      let value = values[feature]

      // Missing or falsy values don't match
      if (!value && value !== 0) {
        return false
      }

      switch (feature) {
        case "width":
        case "height":
        case "device-width":
        case "device-height": {
          expValue = toPx(expValue)
          value = toPx(value)
          break
        }
        case "resolution": {
          expValue = toDpi(expValue)
          value = toDpi(value)
          break
        }
        case "aspect-ratio":
        case "device-aspect-ratio":
        case "device-pixel-ratio": {
          expValue = toDecimal(expValue)
          value = toDecimal(value)
          break
        }
        case "grid":
        case "color":
        case "color-index":
        case "monochrome": {
          expValue = Number(expValue) || 1
          value = Number(toString(value)) || 0
          break
        }
        // case "orientation":
        // case "prefers-reduced-motion":
        // case "prefers-contrast":
        // case "prefers-color-scheme":
        // case "forced-colors":
        // case "inverted-colors":
        // case "hover":
        // case "pointer":
        // case "any-hover":
        // case "any-pointer":
        default: {
          return toString(value) === toString(expValue)
        }
      }

      switch (modifier) {
        case "min": {
          return value >= expValue
        }
        case "max": {
          return value <= expValue
        }
        default: {
          return value === expValue
        }
      }
    })

    return (expressionsMatch && !inverse) || (!expressionsMatch && inverse)
  })
}

export default {
  match,
  parse,
  remBase,
}
