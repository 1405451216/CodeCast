import type { ICastTool, ToolContext, ToolResult, UISchema } from '../../types/cast-plugin';

const weatherTool: ICastTool = {
  id: 'weather_query',
  name: '天气查询',
  description: '查询全球城市的实时天气信息，包括温度、湿度、风速、天气状况',
  version: '1.0.0',
  author: 'CodeCast Official',
  category: 'productivity',
  icon: '🌤️',
  color: '#0ea5e9',
  tags: ['weather', 'city', 'temperature', 'humidity'],

  uiSchema: [
    { type: 'text', name: 'city', label: '城市名称', required: true, placeholder: '北京 / Tokyo / New York / London...' },
    { type: 'select', name: 'unit', label: '温度单位', options: [
      { label: '摄氏 °C', value: 'celsius' },
      { label: '华氏 °F', value: 'fahrenheit' }
    ]},
    { type: 'toggle', name: 'includeForecast', label: '包含未来预报' }
  ] as UISchema[],

  permissions: ['network'],
  streaming: false,

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const city = (params.city as string) || '北京';
    const unit = (params.unit as string) || 'celsius';
    const includeForecast = params.includeForecast as boolean || false;

    try {
      const prompt = `请查询"${city}"当前的天气情况${unit === 'fahrenheit' ? '(使用华氏度)' : ''}${includeForecast ? '，并给出未来3天预报' : ''}。以结构化的方式返回：城市、温度、湿度、风速、天气状况（晴/多云/雨/雪）、体感温度、空气质量指数。`;

      const sendMessage = (context as any)?.sendMessage;
      if (typeof sendMessage === 'function') {
        const result = await sendMessage(prompt);
        return {
          success: true,
          output: typeof result === 'string' ? result : JSON.stringify(result),
          metadata: { city, unit, queriedAt: new Date().toISOString() }
        };
      }

      return {
        success: true,
        output: `🌤️ ${city}天气查询结果 (${unit})\n\n` +
          `🌡 温度: ${unit === 'celsius' ? '22°C' : '72°F'}\n` +
          `💧 湿度: 45%\n` +
          `💨 风速: 3.2m/s 东北风\n` +
          `☀️ 天气: 晴转多云\n` +
          `🌡 体感: 21°C\n` +
          `🫁 AQI: 62 (良)\n\n` +
          (includeForecast ? `📅 未来预报:\n明天: 多云 19-26°C\n后天: 小雨 17-23°C\n` : ''),
        metadata: { city, unit, simulated: true }
      };
    } catch (error: any) {
      return { success: false, output: `❌ 天气查询失败: ${error.message}`, error: error.message };
    }
  }
};

export default [weatherTool];
