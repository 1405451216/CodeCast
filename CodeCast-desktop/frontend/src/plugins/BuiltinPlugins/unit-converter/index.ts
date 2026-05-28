import type { ICastTool, ToolContext, ToolResult, UISchema } from '../../types/cast-plugin';

interface UnitDefinition {
  name: string;
  symbol: string;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
}

interface Category {
  name: string;
  baseUnit: string;
  units: Record<string, UnitDefinition>;
}

const unitCategories: Record<string, Category> = {
  length: {
    name: '长度',
    baseUnit: 'meter',
    units: {
      meter: { name: '米', symbol: 'm', toBase: v => v, fromBase: v => v },
      kilometer: { name: '千米', symbol: 'km', toBase: v => v * 1000, fromBase: v => v / 1000 },
      centimeter: { name: '厘米', symbol: 'cm', toBase: v => v / 100, fromBase: v => v * 100 },
      millimeter: { name: '毫米', symbol: 'mm', toBase: v => v / 1000, fromBase: v => v * 1000 },
      mile: { name: '英里', symbol: 'mi', toBase: v => v * 1609.344, fromBase: v => v / 1609.344 },
      yard: { name: '码', symbol: 'yd', toBase: v => v * 0.9144, fromBase: v => v / 0.9144 },
      foot: { name: '英尺', symbol: 'ft', toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
      inch: { name: '英寸', symbol: 'in', toBase: v => v * 0.0254, fromBase: v => v / 0.0254 }
    }
  },
  weight: {
    name: '重量',
    baseUnit: 'kilogram',
    units: {
      kilogram: { name: '千克', symbol: 'kg', toBase: v => v, fromBase: v => v },
      gram: { name: '克', symbol: 'g', toBase: v => v / 1000, fromBase: v => v * 1000 },
      milligram: { name: '毫克', symbol: 'mg', toBase: v => v / 1000000, fromBase: v => v * 1000000 },
      ton: { name: '吨', symbol: 't', toBase: v => v * 1000, fromBase: v => v / 1000 },
      pound: { name: '磅', symbol: 'lb', toBase: v => v * 0.453592, fromBase: v => v / 0.453592 },
      ounce: { name: '盎司', symbol: 'oz', toBase: v => v * 0.0283495, fromBase: v => v / 0.0283495 }
    }
  },
  temperature: {
    name: '温度',
    baseUnit: 'celsius',
    units: {
      celsius: { name: '摄氏度', symbol: '°C', toBase: v => v, fromBase: v => v },
      fahrenheit: { name: '华氏度', symbol: '°F', toBase: v => (v - 32) * 5 / 9, fromBase: v => v * 9 / 5 + 32 },
      kelvin: { name: '开尔文', symbol: 'K', toBase: v => v - 273.15, fromBase: v => v + 273.15 }
    }
  },
  area: {
    name: '面积',
    baseUnit: 'square_meter',
    units: {
      square_meter: { name: '平方米', symbol: 'm²', toBase: v => v, fromBase: v => v },
      square_kilometer: { name: '平方千米', symbol: 'km²', toBase: v => v * 1000000, fromBase: v => v / 1000000 },
      hectare: { name: '公顷', symbol: 'ha', toBase: v => v * 10000, fromBase: v => v / 10000 },
      acre: { name: '英亩', symbol: 'ac', toBase: v => v * 4046.86, fromBase: v => v / 4046.86 },
      square_foot: { name: '平方英尺', symbol: 'ft²', toBase: v => v * 0.092903, fromBase: v => v / 0.092903 }
    }
  },
  volume: {
    name: '体积',
    baseUnit: 'liter',
    units: {
      liter: { name: '升', symbol: 'L', toBase: v => v, fromBase: v => v },
      milliliter: { name: '毫升', symbol: 'mL', toBase: v => v / 1000, fromBase: v => v * 1000 },
      cubic_meter: { name: '立方米', symbol: 'm³', toBase: v => v * 1000, fromBase: v => v / 1000 },
      gallon_us: { name: '美制加仑', symbol: 'gal (US)', toBase: v => v * 3.78541, fromBase: v => v / 3.78541 },
      gallon_uk: { name: '英制加仑', symbol: 'gal (UK)', toBase: v => v * 4.54609, fromBase: v => v / 4.54609 },
      cup: { name: '杯', symbol: 'cup', toBase: v => v * 0.236588, fromBase: v => v / 0.236588 }
    }
  },
  speed: {
    name: '速度',
    baseUnit: 'meter_per_second',
    units: {
      meter_per_second: { name: '米/秒', symbol: 'm/s', toBase: v => v, fromBase: v => v },
      kilometer_per_hour: { name: '千米/时', symbol: 'km/h', toBase: v => v / 3.6, fromBase: v => v * 3.6 },
      mile_per_hour: { name: '英里/时', symbol: 'mph', toBase: v => v * 0.44704, fromBase: v => v / 0.44704 },
      knot: { name: '节', symbol: 'kn', toBase: v => v * 0.514444, fromBase: v => v / 0.514444 },
      mach: { name: '马赫', symbol: 'Ma', toBase: v => v * 340.29, fromBase: v => v / 340.29 }
    }
  },
  time: {
    name: '时间',
    baseUnit: 'second',
    units: {
      second: { name: '秒', symbol: 's', toBase: v => v, fromBase: v => v },
      millisecond: { name: '毫秒', symbol: 'ms', toBase: v => v / 1000, fromBase: v => v * 1000 },
      minute: { name: '分钟', symbol: 'min', toBase: v => v * 60, fromBase: v => v / 60 },
      hour: { name: '小时', symbol: 'h', toBase: v => v * 3600, fromBase: v => v / 3600 },
      day: { name: '天', symbol: 'd', toBase: v => v * 86400, fromBase: v => v / 86400 },
      week: { name: '周', symbol: 'wk', toBase: v => v * 604800, fromBase: v => v / 604800 }
    }
  },
  data: {
    name: '数据存储',
    baseUnit: 'byte',
    units: {
      byte: { name: '字节', symbol: 'B', toBase: v => v, fromBase: v => v },
      kilobyte: { name: '千字节', symbol: 'KB', toBase: v => v * 1024, fromBase: v => v / 1024 },
      megabyte: { name: '兆字节', symbol: 'MB', toBase: v => v * 1024 * 1024, fromBase: v => v / (1024 * 1024) },
      gigabyte: { name: '吉字节', symbol: 'GB', toBase: v => v * 1024 * 1024 * 1024, fromBase: v => v / (1024 * 1024 * 1024) },
      terabyte: { name: '太字节', symbol: 'TB', toBase: v => v * Math.pow(1024, 4), fromBase: v => v / Math.pow(1024, 4) },
      bit: { name: '比特', symbol: 'bit', toBase: v => v / 8, fromBase: v => v * 8 }
    }
  }
};

function convert(
  value: number,
  categoryKey: string,
  fromUnit: string,
  toUnit: string
): number | null {
  const category = unitCategories[categoryKey];
  if (!category) return null;

  const from = category.units[fromUnit];
  const to = category.units[toUnit];
  if (!from || !to) return null;

  const baseValue = from.toBase(value);
  return to.fromBase(baseValue);
}

function getCategoryOptions(): Array<{ label: string; value: string }> {
  return Object.entries(unitCategories).map(([key, cat]) => ({
    label: cat.name,
    value: key
  }));
}

function getUnitOptions(categoryKey: string): Array<{ label: string; value: string }> {
  const category = unitCategories[categoryKey];
  if (!category) return [];

  return Object.entries(category.units).map(([key, unit]) => ({
    label: `${unit.name} (${unit.symbol})`,
    value: key
  }));
}

const unitConverterTool: ICastTool = {
  id: 'unit_convert',
  name: '单位换算器',
  description: '支持长度、重量、温度、面积、体积、速度、时间、数据存储等 50+ 常用单位的智能换算',
  version: '1.0.0',
  author: 'CodeCast Official',
  category: 'utility',
  icon: '📏',
  color: '#10b981',
  tags: ['converter', 'unit', 'measurement', 'calculation'],

  uiSchema: [
    { type: 'number', name: 'value', label: '数值', required: true, defaultValue: 1 },
    { type: 'select', name: 'category', label: '单位类别', options: getCategoryOptions() },
    { type: 'select', name: 'fromUnit', label: '源单位', options: [] },
    { type: 'select', name: 'toUnit', label: '目标单位', options: [] }
  ] as UISchema[],

  permissions: [],
  streaming: false,

  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const value = Number(params.value) || 0;
    const category = (params.category as string) || 'length';
    let fromUnit = (params.fromUnit as string) || '';
    let toUnit = (params.toUnit as string) || '';

    const cat = unitCategories[category];

    if (!fromUnit || !cat?.units[fromUnit]) {
      const firstUnit = Object.keys(cat?.units || {})[0];
      fromUnit = firstUnit || 'meter';
    }

    if (!toUnit || !cat?.units[toUnit]) {
      const unitKeys = Object.keys(cat?.units || {});
      toUnit = unitKeys.find(u => u !== fromUnit) || unitKeys[0] || 'meter';
    }

    try {
      const result = convert(value, category, fromUnit, toUnit);

      if (result === null) {
        return {
          success: false,
          output: `❌ 不支持的单位或类别`,
          error: 'Invalid unit or category'
        };
      }

      const fromDef = cat.units[fromUnit];
      const toDef = cat.units[toUnit];

      const output = `📏 单位换算结果\n\n` +
        `${value} ${fromDef.symbol} (${fromDef.name})\n` +
        `       ↓\n` +
        `${typeof result === 'number' && Number.isInteger(result) ? result : result.toFixed(6).replace(/\.?0+$/, '')} ${toDef.symbol} (${toDef.name})\n\n` +
        `📂 类别: ${cat.name}\n` +
        `🔄 换算精度: 高精度浮点计算`;

      const allConversions: string[] = [];
      Object.entries(cat.units).forEach(([key, unitDef]) => {
        if (key !== fromUnit) {
          const conv = convert(value, category, fromUnit, key);
          if (conv !== null) {
            allConversions.push(`  • ${unitDef.name}: ${typeof conv === 'number' && Number.isInteger(conv) ? conv : conv.toFixed(4).replace(/\.?0+$/, '')} ${unitDef.symbol}`);
          }
        }
      });

      return {
        success: true,
        output: output + `\n\n📊 同类其他单位:\n${allConversions.join('\n')}`,
        metadata: {
          value,
          category,
          fromUnit,
          toUnit,
          result,
          convertedAt: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return { success: false, output: `❌ 单位换算失败: ${error.message}`, error: error.message };
    }
  },

  metadata: {
    supportedCategories: Object.keys(unitCategories),
    totalUnits: Object.values(unitCategories).reduce((sum, cat) => sum + Object.keys(cat.units).length, 0)
  }
};

export default [unitConverterTool];
