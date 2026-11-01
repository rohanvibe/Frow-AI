type Token = number | '+' | '-' | '*' | '/' | '%' | '^' | '(' | ')'

/** Evaluate a small arithmetic language without executing JavaScript. */
export function evaluateMathExpression(expression: string): number {
  if (typeof expression !== 'string' || expression.length > 512) {
    throw new Error('Invalid expression')
  }

  const source = expression
    .replace(/Ã—/g, '*')
    .replace(/Ã·/g, '/')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
  const tokens: Token[] = []
  let offset = 0

  while (offset < source.length) {
    if (/\s/.test(source[offset])) {
      offset++
      continue
    }

    const rest = source.slice(offset)
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i)
    if (number) {
      const value = Number(number[0])
      if (!Number.isFinite(value)) throw new Error('Invalid number')
      tokens.push(value)
      offset += number[0].length
      continue
    }

    if (source[offset] === '*' && source[offset + 1] === '*') {
      tokens.push('^')
      offset += 2
      continue
    }

    const character = source[offset]
    if ('+-*/%^()'.includes(character)) {
      tokens.push(character as Token)
      offset++
      continue
    }

    // Names, property access, calls, and every other JavaScript token fail here.
    throw new Error('Unsupported expression')
  }

  if (tokens.length === 0 || tokens.length > 256) {
    throw new Error('Invalid expression')
  }

  let position = 0
  const peek = () => tokens[position]
  const consume = () => tokens[position++]
  const ensureFinite = (value: number) => {
    if (!Number.isFinite(value)) throw new Error('Invalid result')
    return value
  }

  const parseExpression = (): number => {
    let value = parseProduct()
    while (peek() === '+' || peek() === '-') {
      const operator = consume()
      const right = parseProduct()
      value = ensureFinite(operator === '+' ? value + right : value - right)
    }
    return value
  }

  const parseProduct = (): number => {
    let value = parseUnary()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const operator = consume()
      const right = parseUnary()
      if ((operator === '/' || operator === '%') && right === 0) {
        throw new Error('Division by zero')
      }
      if (operator === '*') value = ensureFinite(value * right)
      else if (operator === '/') value = ensureFinite(value / right)
      else value = ensureFinite(value % right)
    }
    return value
  }

  const parseUnary = (): number => {
    if (peek() === '+' || peek() === '-') {
      const operator = consume()
      const value = parseUnary()
      return ensureFinite(operator === '-' ? -value : value)
    }
    return parsePower()
  }

  const parsePower = (): number => {
    const base = parsePrimary()
    if (peek() !== '^') return base
    consume()
    return ensureFinite(base ** parseUnary())
  }

  const parsePrimary = (): number => {
    const token = consume()
    if (typeof token === 'number') return token
    if (token === '(') {
      const value = parseExpression()
      if (consume() !== ')') throw new Error('Unclosed parenthesis')
      return value
    }
    throw new Error('Expected a number')
  }

  const result = parseExpression()
  if (position !== tokens.length) throw new Error('Unexpected token')
  return ensureFinite(result)
}
