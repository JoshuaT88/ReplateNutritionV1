/**
 * US State Base Sales Tax Rates (2025)
 * Source: Tax Foundation / state revenue departments
 * Note: Does not include county/city additions.
 * Applied to the total purchase at checkout, not per-item.
 */
export const STATE_TAX_RATES: Record<string, { rate: number; name: string; note?: string }> = {
  AL: { rate: 0.04,   name: 'Alabama',       note: 'Local avg ~5% additional' },
  AK: { rate: 0,      name: 'Alaska',        note: 'No state sales tax' },
  AZ: { rate: 0.056,  name: 'Arizona' },
  AR: { rate: 0.065,  name: 'Arkansas' },
  CA: { rate: 0.0725, name: 'California' },
  CO: { rate: 0.029,  name: 'Colorado',      note: 'Local avg ~4.9% additional' },
  CT: { rate: 0.0635, name: 'Connecticut' },
  DE: { rate: 0,      name: 'Delaware',      note: 'No sales tax' },
  FL: { rate: 0.06,   name: 'Florida' },
  GA: { rate: 0.04,   name: 'Georgia' },
  HI: { rate: 0.04,   name: 'Hawaii' },
  ID: { rate: 0.06,   name: 'Idaho' },
  IL: { rate: 0.0625, name: 'Illinois' },
  IN: { rate: 0.07,   name: 'Indiana' },
  IA: { rate: 0.06,   name: 'Iowa' },
  KS: { rate: 0.065,  name: 'Kansas' },
  KY: { rate: 0.06,   name: 'Kentucky' },
  LA: { rate: 0.0445, name: 'Louisiana' },
  ME: { rate: 0.055,  name: 'Maine' },
  MD: { rate: 0.06,   name: 'Maryland' },
  MA: { rate: 0.0625, name: 'Massachusetts' },
  MI: { rate: 0.06,   name: 'Michigan' },
  MN: { rate: 0.0688, name: 'Minnesota' },
  MS: { rate: 0.07,   name: 'Mississippi' },
  MO: { rate: 0.04225,name: 'Missouri' },
  MT: { rate: 0,      name: 'Montana',       note: 'No sales tax' },
  NE: { rate: 0.055,  name: 'Nebraska' },
  NV: { rate: 0.0685, name: 'Nevada' },
  NH: { rate: 0,      name: 'New Hampshire', note: 'No sales tax' },
  NJ: { rate: 0.0663, name: 'New Jersey' },
  NM: { rate: 0.05,   name: 'New Mexico' },
  NY: { rate: 0.04,   name: 'New York',      note: 'Local avg ~4.5% additional' },
  NC: { rate: 0.0475, name: 'North Carolina' },
  ND: { rate: 0.05,   name: 'North Dakota' },
  OH: { rate: 0.0575, name: 'Ohio' },
  OK: { rate: 0.045,  name: 'Oklahoma' },
  OR: { rate: 0,      name: 'Oregon',        note: 'No sales tax' },
  PA: { rate: 0.06,   name: 'Pennsylvania' },
  RI: { rate: 0.07,   name: 'Rhode Island' },
  SC: { rate: 0.06,   name: 'South Carolina' },
  SD: { rate: 0.042,  name: 'South Dakota' },
  TN: { rate: 0.07,   name: 'Tennessee',     note: '+2.75% local avg; food rate 4%' },
  TX: { rate: 0.0625, name: 'Texas' },
  UT: { rate: 0.0485, name: 'Utah' },
  VT: { rate: 0.06,   name: 'Vermont' },
  VA: { rate: 0.053,  name: 'Virginia' },
  WA: { rate: 0.065,  name: 'Washington' },
  WV: { rate: 0.06,   name: 'West Virginia' },
  WI: { rate: 0.05,   name: 'Wisconsin' },
  WY: { rate: 0.04,   name: 'Wyoming' },
  DC: { rate: 0.06,   name: 'Washington D.C.' },
};

export const US_STATES = Object.entries(STATE_TAX_RATES).map(([abbr, { name }]) => ({
  abbr,
  name,
})).sort((a, b) => a.name.localeCompare(b.name));

export function getTaxRate(stateAbbr?: string | null): number {
  if (!stateAbbr) return 0;
  return STATE_TAX_RATES[stateAbbr.toUpperCase()]?.rate ?? 0;
}
