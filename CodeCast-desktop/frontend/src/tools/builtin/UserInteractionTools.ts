import { AgentTool, ToolCategory, ToolContext, ToolPermission, ToolResult } from '../types';

const askUser: AgentTool = {
  id: 'ask_user',
  name: '询问用户',
  description: '当需要人类决策、确认或输入时暂停执行并向用户提问，等待用户响应后继续',
  category: ToolCategory.INTERACTION,
  permission: ToolPermission.NONE,
  requiresPermission: false,
  tags: ['interaction', 'user-input', 'decision'],
  version: '1.0.0',

  parameters: [
    {
      name: 'question',
      type: 'string',
      description: '向用户提出的问题或需要决策的内容描述',
      required: true
    },
    {
      name: 'options',
      type: 'array',
      description: '可选的预设选项列表（用户可从中选择）',
      required: false,
      items: { name: 'option', type: 'string', description: '选项文本' }
    },
    {
      name: 'default_value',
      type: 'string',
      description: '默认值或默认选项',
      required: false
    },
    {
      name: 'placeholder',
      type: 'string',
      description: '输入框的占位提示文本',
      required: false
    },
    {
      name: 'context_description',
      type: 'string',
      description: '提供额外的上下文信息帮助用户理解问题背景',
      required: false
    }
  ],

  examples: [
    {
      params: { question: '请选择要使用的包管理器:', options: ['npm', 'yarn', 'pnpm'] },
      description: '让用户选择包管理器'
    },
    {
      params: { question: '请输入项目名称:', placeholder: 'my-project', default_value: 'codecast-app' },
      description: '让用户输入项目名称'
    },
    {
      params: { question: '是否继续执行此操作？', options: ['是，继续', '否，取消'], context_description: '此操作将修改 3 个文件' },
      description: '在关键操作前询问用户确认'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (!context.ui?.askUser) {
        return {
          success: false,
          error: 'UI 接口不可用，无法与用户交互',
          metadata: { missingInterface: 'ui.askUser' }
        };
      }

      const fullQuestion = params.context_description
        ? `${params.context_description}\n\n${params.question}`
        : params.question;

      context.logger?.info(`[InteractionTool] Asking user: ${fullQuestion}`);

      const userResponse = await context.ui.askUser(fullQuestion, {
        placeholder: params.placeholder,
        defaultValue: params.default_value
      });

      let finalAnswer = userResponse;

      if (params.options && !params.options.includes(userResponse)) {
        if (params.options.some((opt: string) => opt.toLowerCase() === userResponse.toLowerCase())) {
          finalAnswer = params.options.find((opt: string) => opt.toLowerCase() === userResponse.toLowerCase()) || userResponse;
        } else {
          context.logger?.warn(`[InteractionTool] User response "${userResponse}" not in predefined options`);
        }
      }

      return {
        success: true,
        data: {
          question: params.question,
          answer: finalAnswer,
          originalInput: userResponse
        },
        output: `用户回复: ${finalAnswer}`,
        metadata: {
          question: params.question,
          hasOptions: !!params.options?.length,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `用户交互失败: ${message}`,
        metadata: { originalError: message }
      };
    }
  }
};

const showConfirmation: AgentTool = {
  id: 'show_confirmation',
  name: '显示确认对话框',
  description: '向用户显示一个确认对话框，用于危险操作前的二次确认或重要决策',
  category: ToolCategory.INTERACTION,
  permission: ToolPermission.NONE,
  requiresPermission: false,
  tags: ['interaction', 'confirmation', 'dialog'],
  version: '1.0.0',

  parameters: [
    {
      name: 'message',
      type: 'string',
      description: '确认对话框中显示的消息内容',
      required: true
    },
    {
      name: 'title',
      type: 'string',
      description: '对话框标题',
      required: false,
      default: '确认操作'
    },
    {
      name: 'dangerous',
      type: 'boolean',
      description: '是否标记为危险操作（会显示警告样式）',
      required: false,
      default: false
    },
    {
      name: 'details',
      type: 'string',
      description: '操作的详细说明或影响范围',
      required: false
    }
  ],

  examples: [
    {
      params: { message: '确定要删除这个文件吗？此操作不可逆。', title: '删除确认', dangerous: true },
      description: '删除文件前的危险操作确认'
    },
    {
      params: { message: '是否提交这些更改到 Git？', title: 'Git 提交', details: '包含 5 个文件的修改' },
      description: 'Git 提交前的确认'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (!context.ui?.showConfirmation) {
        return {
          success: false,
          error: 'UI 接口不可用，无法显示确认对话框',
          metadata: { missingInterface: 'ui.showConfirmation' }
        };
      }

      let fullMessage = params.message;
      if (params.details) {
        fullMessage += `\n\n详细信息:\n${params.details}`;
      }

      context.logger?.info(`[InteractionTool] Showing confirmation: ${params.title}`);

      const confirmed = await context.ui.showConfirmation(fullMessage, {
        title: params.title || '确认操作'
      });

      return {
        success: true,
        data: {
          confirmed,
          title: params.title || '确认操作',
          isDangerous: params.dangerous
        },
        output: confirmed ? '用户确认了操作' : '用户取消了操作',
        metadata: {
          confirmed,
          dangerous: params.dangerous,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `显示确认框失败: ${message}`,
        metadata: { originalError: message }
      };
    }
  }
};

export const userInteractionTools: AgentTool[] = [askUser, showConfirmation];

export default userInteractionTools;
