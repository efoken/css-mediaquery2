const RE_MEDIA_QUERY =
  /^(?:(only|not)?\s*([_a-z][\w-]*)|(\([^)]+\)))(?:\s*and\s*(.*))?$/i
const RE_MQ_EXPRESSION = /^\(\s*([_a-z-][\d_a-z-]*)\s*(?::\s*([^)]+))?\s*\)$/i
const RE_MQ_FEATURE = /^(?:-(webkit|moz|o)-)?(?:(min|max)-)?(?:-(moz)-)?(.+)/
const RE_LENGTH_UNIT = /(em|rem|px|cm|mm|in|pt|pc)?\s*$/
const RE_RESOLUTION_UNIT = /(dpi|dpcm|dppx|x)?\s*$/
const RE_COMMENTS = /\/\*[^*]*\*+([^/][^*]*\*+)*\//gi

export interface MediaValues {
  orientation: "portrait" | "landscape"
  width: string | number
  height: string | number
  resolution: string | number
  "aspect-ratio": string | number
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

type Comparator = "=" | "<" | "<=" | ">" | ">="

interface Expression {
  feature: keyof MediaValues
  value: string
  comparator: Comparator
}

interface QueryNode {
  inverse: boolean
  type: string
  expressions: Expression[]
}

export type AST = QueryNode[]

const comparatorMap: Record<string, Comparator> = {
  "<": ">",
  "<=": ">=",
  ">": "<",
  ">=": "<=",
}

const toString = (string: string | number) => string.toString().toLowerCase()

const toFloat = (string: string | number) => Number.parseFloat(toString(string))

const toDecimal = (ratio: string | number) =>
  Number(
    toString(ratio).replace(
      /^(\d+)\s*\/\s*(\d+)$/,
      (_, a, b) => (a / b) as any,
    ),
  )

const dpiUnits: Record<string, number> = {
  dpcm: 1 / 2.54,
  dppx: 96,
  x: 96,
}

const toDpi = (resolution: string | number) => {
  const value = toFloat(resolution)
  const units = RE_RESOLUTION_UNIT.exec(toString(resolution))?.[1]

  return units ? value * (dpiUnits[units] || 1) : value
}

const pxUnits: Record<string, number> = {
  em: 16,
  rem: 16,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  in: 96,
  pt: 96 / 72,
  pc: 96 / 6,
}

const toPx = (length: string | number) => {
  const value = toFloat(length)
  const units = RE_LENGTH_UNIT.exec(toString(length))?.[1]

  return units ? value * (pxUnits[units] || 1) : value
}

const isFeatureToken = (string: string) => /^[_a-z-][\d_a-z-]*$/i.test(string)

const cache = new Map<string, AST>()

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
  const cached = cache.get(query)
  if (cached) {
    return cached
  }

  const ast = query.split(",").map<QueryNode>((query) => {
    // Remove comments first
    query = query.replace(RE_COMMENTS, "").trim()

    const createSyntaxError = () =>
      new SyntaxError(`Invalid CSS media query: "${query}"`)

    const captures = RE_MEDIA_QUERY.exec(query)

    // Media Query must be valid
    if (!captures) {
      throw createSyntaxError()
    }

    const [, modifier, type] = captures
    const expressions = ((captures[3] || "") + (captures[4] || ""))
      .trim()
      // Split expressions into a list
      .match(/\([^)]+\)/g)

    // Media Query must be valid
    if (!expressions && !modifier && !type) {
      throw createSyntaxError()
    }

    return {
      inverse: modifier === "not",
      type: type || "all",
      expressions:
        expressions?.flatMap((expression) => {
          // Try `(feature: value)` syntax first
          const captures = RE_MQ_EXPRESSION.exec(expression)

          if (captures) {
            const feature = RE_MQ_FEATURE.exec(toString(captures[1]))

            // Media Query must be valid
            if (!feature) {
              throw createSyntaxError()
            }

            return [
              {
                feature: feature[4],
                value: captures[2],
                comparator:
                  feature[2] === "min"
                    ? ">="
                    : feature[2] === "max"
                      ? "<="
                      : "=",
              } as Expression,
            ]
          }

          // Modern comparator syntax, e.g. `(width <= 700px)` or
          // `(400px <= width <= 700px)`
          const inner = expression.slice(1, -1).trim()
          const parts = inner
            .split(/\s*(<=|>=|<|>)\s*/)
            .map((s) => s.trim())
            .filter(Boolean)

          if (parts.length === 3) {
            const [left, op, right] = parts
            // Determine which side is the feature
            if (isFeatureToken(left)) {
              const feature = toString(left)
              // left < right => feature < right (max, comparator '<' or '<=')
              // left > right => feature > right (min, comparator '>' or '>=')
              const comparator = op as Comparator
              return [
                {
                  feature,
                  value: right,
                  comparator,
                } as Expression,
              ]
            }

            if (isFeatureToken(right)) {
              const feature = toString(right)
              // left < right => left < feature => feature > left
              const comparator = comparatorMap[op]
              return [
                {
                  feature,
                  value: left,
                  comparator,
                } as Expression,
              ]
            }
          }

          if (parts.length === 5) {
            const [left, op1, middle, op2, right] = parts

            // Feature must be in the middle
            if (!isFeatureToken(middle)) {
              throw createSyntaxError()
            }

            const feature = toString(middle) as keyof MediaValues
            const expressions: Expression[] = []

            // left op1 middle
            let comparator = comparatorMap[op1]
            expressions.push({
              feature,
              value: left,
              comparator,
            })

            // middle op2 right
            comparator = op2 as Comparator
            expressions.push({
              feature,
              value: right,
              comparator,
            })

            return expressions
          }

          throw createSyntaxError()
        }) ?? [],
    }
  })

  cache.set(query, ast)
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
      const { feature, comparator } = expression
      let expValue: string | number = expression.value
      let value = values[feature]

      // Missing or falsy values don't match
      if (!value && value !== 0) {
        return false
      }

      switch (true) {
        // case "width":
        // case "height":
        case /^(device-)?(width|height)$/.test(feature): {
          expValue = toPx(expValue)
          value = toPx(value)
          break
        }
        case /^resolution$/.test(feature): {
          expValue = toDpi(expValue)
          value = toDpi(value)
          break
        }
        case /^(device-)?(aspect|pixel)-ratio$/.test(feature): {
          expValue = toDecimal(expValue)
          value = toDecimal(value)
          break
        }
        case /^(grid|color(-index)?|monochrome)$/.test(feature): {
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
          return value === expValue
        }
      }

      switch (comparator) {
        case ">": {
          return value > expValue
        }
        case ">=": {
          return value >= expValue
        }
        case "<": {
          return value < expValue
        }
        case "<=": {
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
}
