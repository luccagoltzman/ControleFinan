export function calcSalePriceByMarkup(cost: number, markupPercent01: number) {
  return cost * (1 + markupPercent01)
}

export function calcSalePriceByTargetMargin(cost: number, targetMargin01: number) {
  const denom = 1 - targetMargin01
  if (denom <= 0) return null
  return cost / denom
}

