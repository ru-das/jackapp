export const StatMeta = {
  "name": "Stat",
  "tier": "P0",
  "hint": "Show a computed number. Use $agg/$math for totals, averages, splits.",
  "example": {
    "label": "Total",
    "value": {
      "$agg": {
        "op": "count",
        "of": "items"
      }
    }
  },
  "children": false,
  "capabilities": []
} as const;
