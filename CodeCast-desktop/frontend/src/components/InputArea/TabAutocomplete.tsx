import React, { useState, useEffect, useCallback, useMemo } from 'react';

type AutocompleteType = 'text' | 'command' | 'context' | 'code';

interface AutocompleteItem {
  type: AutocompleteType;
  text: string;
  display: string;
  description?: string;
  icon?: string;
}

interface TabAutocompleteProps {
  visible: boolean;
  items: AutocompleteItem[];
  selectedIndex: number;
  onSelect: (item: AutocompleteItem) => void;
  onNavigate: (index: number) => void;
  onClose: () => void;
  position: { top: number; left: number };
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

const CODE_SNIPPETS: Record<string, { text: string; display: string; description: string; category: string }> = {
  'func': { text: 'function name(params) {\n  \n}', display: '函数', description: 'JavaScript/TypeScript 函数模板', category: 'JavaScript' },
  'async': { text: 'async function name(params) {\n  const result = await \n  return result;\n}', display: '异步函数', description: 'Async/Await 函数模板', category: 'JavaScript' },
  'if': { text: 'if (condition) {\n  \n}', display: '条件判断', description: 'If 条件语句', category: 'JavaScript' },
  'else': { text: 'if (condition) {\n  \n} else {\n  \n}', display: 'If-Else', description: 'If-Else 分支语句', category: 'JavaScript' },
  'for': { text: 'for (let i = 0; i < ; i++) {\n  \n}', display: 'For 循环', description: 'For 循环语句', category: 'JavaScript' },
  'foreach': { text: '.forEach((item) => {\n  \n});', display: 'ForEach', description: '数组遍历方法', category: 'JavaScript' },
  'map': { text: '.map((item) => {\n  return \n});', display: 'Map 映射', description: '数组映射转换', category: 'JavaScript' },
  'filter': { text: '.filter((item) => {\n  return \n});', display: 'Filter 过滤', description: '数组过滤方法', category: 'JavaScript' },
  'reduce': { text: '.reduce((acc, item) => {\n  return acc;\n}, initialValue);', display: 'Reduce 累计', description: '数组累计计算', category: 'JavaScript' },
  'find': { text: '.find((item) => {\n  return \n});', display: 'Find 查找', description: '数组查找元素', category: 'JavaScript' },
  'some': { text: '.some((item) => {\n  return \n});', display: 'Some 判断', description: '数组是否存在满足条件元素', category: 'JavaScript' },
  'every': { text: '.every((item) => {\n  return \n});', display: 'Every 判断', description: '数组是否全部满足条件', category: 'JavaScript' },
  'class': { text: 'class ClassName {\n  constructor() {\n    \n  }\n  \n  method() {\n    \n  }\n}', display: '类定义', description: 'ES6 Class 模板', category: 'JavaScript' },
  'try': { text: 'try {\n  \n} catch (error) {\n  console.error(error);\n}', display: 'Try-Catch', description: '错误处理模板', category: 'JavaScript' },
  'import': { text: "import {  } from '';", display: 'Import 导入', description: 'ES Module 导入', category: 'JavaScript' },
  'export': { text: "export default ", display: 'Export 导出', description: '模块导出', category: 'JavaScript' },
  'const': { text: 'const  = ;', display: '常量声明', description: 'Const 声明', category: 'JavaScript' },
  'let': { text: 'let  = ;', display: '变量声明', description: 'Let 声明', category: 'JavaScript' },
  'log': { text: "console.log();", display: 'Console.log', description: '控制台输出', category: 'JavaScript' },
  'arrow': { text: '() => {\n  \n};', display: '箭头函数', description: 'Arrow Function 模板', category: 'JavaScript' },
  'switch': { text: 'switch (value) {\n  case :\n    break;\n  default:\n    \n}', display: 'Switch', description: 'Switch 分支语句', category: 'JavaScript' },
  'promise': { text: 'new Promise((resolve, reject) => {\n  \n});', display: 'Promise', description: 'Promise 构造器', category: 'JavaScript' },
  'react': { text: "const [state, setState] = useState();\n\nuseEffect(() => {\n  \n}, []);", display: 'React 组件', description: 'React 函数组件骨架', category: 'React' },
  'api': { text: 'async function apiCall() {\n  try {\n    const response = await fetch(url);\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error("API Error:", error);\n    throw error;\n  }\n}', display: 'API 调用', description: 'Fetch API 封装', category: 'JavaScript' },
  'component': { text: 'const Component = ({ prop }) => {\n  return (\n    <div>\n      \n    </div>\n  );\n};\n\nexport default Component;', display: 'React FC', description: 'React FC 完整模板', category: 'React' },
  'hook': { text: 'function useCustomHook() {\n  const [state, setState] = useState(initialValue);\n  \n  useEffect(() => {\n    \n  }, []);\n  \n  return state;\n}', display: '自定义 Hook', description: 'React 自定义 Hook 模板', category: 'React' },
  'context': { text: 'const MyContext = createContext();\n\nfunction Provider({ children }) {\n  const [state, setState] = useState();\n  \n  return (\n    <MyContext.Provider value={{ state, setState }}>\n      {children}\n    </MyContext.Provider>\n  );\n}\n\nfunction useMyContext() {\n  const context = useContext(MyContext);\n  if (!context) throw new Error("Must use within Provider");\n  return context;\n}', display: 'Context API', description: 'React Context 完整实现', category: 'React' },
  'useeffect': { text: 'useEffect(() => {\n  \n  return () => {\n    cleanup\n  };\n}, [dependencies]);', display: 'UseEffect', description: 'React Effect Hook', category: 'React' },
  'usecallback': { text: 'useCallback(() => {\n  \n}, [dependencies]);', display: 'UseCallback', description: 'React Callback Hook', category: 'React' },
  'usememo': { text: 'useMemo(() => {\n  return computedValue;\n}, [dependencies]);', display: 'UseMemo', description: 'React Memo Hook', category: 'React' },
  'useref': { text: 'const ref = useRef(initialValue);', display: 'UseRef', description: 'React Ref Hook', category: 'React' },
  'reducer': { text: 'const initialState = {};\n\nfunction reducer(state, action) {\n  switch (action.type) {\n    case \'ACTION\':\n      return { ...state, ...action.payload };\n    default:\n      return state;\n  }\n}\n\nconst [state, dispatch] = useReducer(reducer, initialState);', display: 'UseReducer', description: 'React Reducer 模式', category: 'React' },
  'def': { text: 'def function_name(params):\n    """Function docstring"""\n    pass', display: '函数定义', description: 'Python 函数定义', category: 'Python' },
  'classpy': { text: 'class ClassName:\n    """Class docstring"""\n    def __init__(self, params):\n        self.param = params\n    \n    def method(self):\n        pass', display: 'Python 类', description: 'Python 类定义模板', category: 'Python' },
  'ifpy': { text: 'if condition:\n    pass\nelif other_condition:\n    pass\nelse:\n    pass', display: 'Python If', description: 'Python 条件语句', category: 'Python' },
  'forpy': { text: 'for item in iterable:\n    pass', display: 'Python For', description: 'Python For 循环', category: 'Python' },
  'whilepy': { text: 'while condition:\n    pass', display: 'Python While', description: 'Python While 循环', category: 'Python' },
  'withpy': { text: 'with open(\'file.txt\', \'r\') as f:\n    content = f.read()', display: 'With 语句', description: 'Python 上下文管理器', category: 'Python' },
  'trypy': { text: 'try:\n    pass\nexcept Exception as e:\n    print(f"Error: {e}")\nfinally:\n    cleanup', display: 'Python Try', description: 'Python 异常处理', category: 'Python' },
  'lambdapy': { text: 'lambda x: expression', display: 'Lambda', description: 'Python Lambda 表达式', category: 'Python' },
  'listcomp': { text: '[expression for item in iterable if condition]', display: '列表推导', description: 'Python 列表推导式', category: 'Python' },
  'dictcomp': { text: '{key: value for item in iterable if condition}', display: '字典推导', description: 'Python 字典推导式', category: 'Python' },
  'genexpr': { text: '(expression for item in iterable)', display: '生成器表达式', description: 'Python 生成器表达式', category: 'Python' },
  'decorator': { text: 'def decorator(func):\n    @wraps(func)\n    def wrapper(*args, **kwargs):\n        result = func(*args, **kwargs)\n        return result\n    return wrapper', display: '装饰器', description: 'Python 装饰器模板', category: 'Python' },
  'asyncpy': { text: 'async def async_function():\n    result = await coroutine()\n    return result', display: '异步函数', description: 'Python Async/Await', category: 'Python' },
  'dataclass': { text: '@dataclass\nclass DataClass:\n    field1: str\n    field2: int = 0', display: 'Dataclass', description: 'Python 数据类', category: 'Python' },
  'typehint': { text: 'from typing import List, Dict, Optional, Union\n\ndef function(\n    param1: str,\n    param2: Optional[int] = None,\n    param3: List[Dict[str, Any]] = None\n) -> bool:\n    pass', display: '类型注解', description: 'Python 类型注解完整示例', category: 'Python' },
  'main': { text: 'if __name__ == "__main__":\n    main()', display: '__main__', description: 'Python 主程序入口', category: 'Python' },
  'logging': { text: 'import logging\n\nlogging.basicConfig(\n    level=logging.INFO,\n    format=\'%(asctime)s - %(name)s - %(levelname)s - %(message)s\'\n)\nlogger = logging.getLogger(__name__)\n\nlogger.info("Message")', display: 'Logging', description: 'Python 日志配置', category: 'Python' },
  'requests': { text: 'import requests\n\nresponse = requests.get(url, params=params, headers=headers)\nresponse.raise_for_status()\ndata = response.json()', display: 'Requests', description: 'Python HTTP 请求', category: 'Python' },
  'unittest': { text: 'import unittest\n\nclass TestClassName(unittest.TestCase):\n    def setUp(self):\n        self.setup_code\n    \n    def test_method(self):\n        self.assertEqual(result, expected)\n    \n    def tearDown(self):\n        cleanup_code\n\nif __name__ == "__main__":\n    unittest.main()', display: 'Unit Test', description: 'Python 单元测试模板', category: 'Python' },
  'pkggo': { text: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}', display: 'Go Main', description: 'Go 主程序包', category: 'Go' },
  'funcgo': { text: 'func functionName(param Type) returnType {\n\t// function body\n\treturn result\n}', display: 'Go 函数', description: 'Go 函数定义', category: 'Go' },
  'structgo': { text: 'type StructName struct {\n\tField1 Type\n\tField2 Type `json:"field_name"`\n}', display: 'Go Struct', description: 'Go 结构体定义', category: 'Go' },
  'interfacego': { text: 'type InterfaceName interface {\n\tMethodName(param Type) returnType\n}', display: 'Go Interface', description: 'Go 接口定义', category: 'Go' },
  'methodgo': { text: 'func (r ReceiverType) MethodName(param Type) returnType {\n\t// method body\n}', display: 'Go 方法', description: 'Go 方法定义', category: 'Go' },
  'goroutine': { text: 'go func() {\n\t// async operation\n}()', display: 'Goroutine', description: 'Go 协程启动', category: 'Go' },
  'channel': { text: 'ch := make(chan Type, bufferSize)\n\n// Send\ngo ch <- value\n\n// Receive\nvalue := <-ch', display: 'Channel', description: 'Go 通道使用', category: 'Go' },
  'selectgo': { text: 'select {\ncase msg := <-ch1:\n\tfmt.Println(msg)\ncase err := <-errCh:\n\tlog.Error(err)\ndefault:\n\tfmt.Println("no activity")\n}', display: 'Select', description: 'Go Select 语句', category: 'Go' },
  'errorgo': { text: 'result, err := someFunction()\nif err != nil {\n\treturn fmt.Errorf("operation failed: %w", err)\n}', display: 'Error 处理', description: 'Go 错误处理模式', category: 'Go' },
  'defer': { text: 'func cleanup() {\n\tdefer file.Close()\n\t// use file\n}', display: 'Defer', description: 'Go 延迟执行', category: 'Go' },
  'mutex': { text: 'var mu sync.Mutex\n\nmu.Lock()\ndefer mu.Unlock()\n// critical section', display: 'Mutex', description: 'Go 互斥锁', category: 'Go' },
  'wgg': { text: 'var wg sync.WaitGroup\n\nfor _, item := range items {\n\twg.Add(1)\n\tgo func(item Type) {\n\t\tdefer wg.Done()\n\t\t// process item\n\t}(item)\n}\nwg.Wait()', display: 'WaitGroup', description: 'Go 并发等待组', category: 'Go' },
  'httpgo': { text: 'http.HandleFunc("/path", handler)\nlog.Fatal(http.ListenAndServe(":8080", nil))\n\nfunc handler(w http.ResponseWriter, r *http.Request) {\n\tw.Write([]byte("Hello"))\n}', display: 'HTTP Server', description: 'Go HTTP 服务器', category: 'Go' },
  'testgo': { text: 'func TestFunctionName(t *testing.T) {\n\ttests := []struct {\n\t\tname     string\n\t\tinput    Type\n\t\texpected Type\n\t}{\n\t\t{"test case", input, expected},\n\t}\n\n\tfor _, tt := range tests {\n\t\tt.Run(tt.name, func(t *testing.T) {\n\t\t\tgot := FunctionName(tt.input)\n\t\t\tif got != tt.expected {\n\t\t\t\tt.Errorf("got %v, want %v", got, tt.expected)\n\t\t\t}\n\t\t})\n\t}\n}', display: 'Go 测试', description: 'Go 测试模板', category: 'Go' },
  'html': { text: '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Document</title>\n</head>\n<body>\n    \n</body>\n</html>', display: 'HTML5 文档', description: 'HTML5 基础文档结构', category: 'HTML/CSS' },
  'div': { text: '<div class="" id="">\n    \n</div>', display: 'Div 容器', description: 'HTML Div 元素', category: 'HTML/CSS' },
  'section': { text: '<section class="">\n    <h2></h2>\n    \n</section>', display: 'Section 区块', description: 'HTML Section 元素', category: 'HTML/CSS' },
  'form': { text: '<form action="" method="POST">\n    <label for="">Label</label>\n    <input type="text" id="" name="" required>\n    \n    <button type="submit">Submit</button>\n</form>', display: 'Form 表单', description: 'HTML 表单模板', category: 'HTML/CSS' },
  'table': { text: '<table>\n    <thead>\n        <tr>\n            <th>Header</th>\n        </tr>\n    </thead>\n    <tbody>\n        <tr>\n            <td>Data</td>\n        </tr>\n    </tbody>\n</table>', display: 'Table 表格', description: 'HTML 表格模板', category: 'HTML/CSS' },
  'nav': { text: '<nav class="navbar">\n    <a href="#" class="logo">Logo</a>\n    <ul class="nav-links">\n        <li><a href="#">Link</a></li>\n    </ul>\n</nav>', display: 'Nav 导航', description: 'HTML 导航栏模板', category: 'HTML/CSS' },
  'cssreset': { text: '* {\n    margin: 0;\n    padding: 0;\n    box-sizing: border-box;\n}\n\nbody {\n    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n    line-height: 1.6;\n}', display: 'CSS Reset', description: 'CSS 重置样式', category: 'HTML/CSS' },
  'flex': { text: '.container {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    gap: 16px;\n}', display: 'Flexbox', description: 'CSS Flexbox 布局', category: 'HTML/CSS' },
  'grid': { text: '.grid-container {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));\n    gap: 24px;\n}', display: 'Grid 布局', description: 'CSS Grid 布局', category: 'HTML/CSS' },
  'center': { text: '.center {\n    position: absolute;\n    top: 50%;\n    left: 50%;\n    transform: translate(-50%, -50%);\n}', display: '居中定位', description: 'CSS 绝对居中', category: 'HTML/CSS' },
  'responsive': { text: '@media screen and (max-width: 768px) {\n    .element {\n        /* mobile styles */\n    }\n}', display: '响应式', description: 'CSS 响应式媒体查询', category: 'HTML/CSS' },
  'animation': { text: '@keyframes animationName {\n    from {\n        opacity: 0;\n        transform: translateY(20px);\n    }\n    to {\n        opacity: 1;\n        transform: translateY(0);\n    }\n}\n\n.element {\n    animation: animationName 0.3s ease-out;\n}', display: '动画', description: 'CSS 动画模板', category: 'HTML/CSS' },
  'variable': { text: ':root {\n    --primary-color: #007bff;\n    --secondary-color: #6c757d;\n    --spacing-unit: 8px;\n}\n\n.element {\n    color: var(--primary-color);\n    padding: calc(var(--spacing-unit) * 2);\n}', display: 'CSS 变量', description: 'CSS 自定义属性', category: 'HTML/CSS' },
  'sqlselect': { text: 'SELECT column1, column2\nFROM table_name\nWHERE condition\nORDER BY column1 ASC\nLIMIT 10;', display: 'SELECT 查询', description: 'SQL SELECT 语句', category: 'SQL' },
  'sqlinsert': { text: 'INSERT INTO table_name (column1, column2)\nVALUES (value1, value2);', display: 'INSERT 插入', description: 'SQL INSERT 语句', category: 'SQL' },
  'sqlupdate': { text: 'UPDATE table_name\nSET column1 = value1, column2 = value2\nWHERE condition;', display: 'UPDATE 更新', description: 'SQL UPDATE 语句', category: 'SQL' },
  'sqldelete': { text: 'DELETE FROM table_name\nWHERE condition;', display: 'DELETE 删除', description: 'SQL DELETE 语句', category: 'SQL' },
  'sqljoin': { text: 'SELECT a.*, b.column\nFROM table_a a\nINNER JOIN table_b b ON a.id = b.a_id\nWHERE a.condition;', display: 'JOIN 连接', description: 'SQL JOIN 查询', category: 'SQL' },
  'sqlgroup': { text: 'SELECT category, COUNT(*), AVG(value)\nFROM table_name\nGROUP BY category\nHAVING COUNT(*) > 1\nORDER BY COUNT(*) DESC;', display: 'GROUP BY', description: 'SQL 分组聚合', category: 'SQL' },
  'subquery': { text: 'SELECT *\nFROM table_name\nWHERE id IN (\n    SELECT id FROM other_table WHERE condition\n);', display: '子查询', description: 'SQL 子查询', category: 'SQL' },
  'cte': { text: 'WITH cte_name AS (\n    SELECT column1, column2\n    FROM table_name\n    WHERE condition\n)\nSELECT *\nFROM cte_name\nWHERE another_condition;', display: 'CTE', description: 'SQL 公用表表达式', category: 'SQL' },
  'window': { text: 'SELECT \n    column,\n    ROW_NUMBER() OVER (PARTITION BY group_col ORDER BY sort_col) as rn,\n    LAG(column) OVER (ORDER BY id) as prev_value,\n    SUM(value) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as running_total\nFROM table_name;', display: '窗口函数', description: 'SQL 窗口函数', category: 'SQL' },
  'indexsql': { text: 'CREATE INDEX idx_name ON table_name (column1, column2);\n\n-- Composite index\nCREATE UNIQUE INDEX idx_unique ON table_name (column1, column2);', display: '索引创建', description: 'SQL 索引优化', category: 'SQL' },
  'shbash': { text: '#!/bin/bash\n\nset -euo pipefail\n\nmain() {\n    echo "Hello, World!"\n}\n\nmain "$@"', display: 'Bash 脚本', description: 'Bash 脚本基础模板', category: 'Shell/Bash' },
  'ifbash': { text: 'if [[ condition ]]; then\n    # do something\nelif [[ other_condition ]]; then\n    # do something else\nelse\n    # fallback\nfi', display: 'Bash If', description: 'Bash 条件语句', category: 'Shell/Bash' },
  'forbash': { text: 'for item in "${array[@]}"; do\n    echo "$item"\ndone', display: 'Bash For', description: 'Bash For 循环', category: 'Shell/Bash' },
  'whilebash': { text: 'while [[ condition ]]; do\n    # loop body\ndone', display: 'Bash While', description: 'Bash While 循环', category: 'Shell/Bash' },
  'casebash': { text: 'case "$variable" in\n    pattern1)\n        command1\n        ;;\n    pattern2|pattern3)\n        command2\n        ;;\n    *)\n        default_command\n        ;;\nesac', display: 'Case 语句', description: 'Bash Case 语句', category: 'Shell/Bash' },
  'funcbash': { text: 'function_name() {\n    local param="$1"\n    echo "Processing: $param"\n    return 0\n}', display: 'Bash 函数', description: 'Bash 函数定义', category: 'Shell/Bash' },
  'parseargs': { text: 'while getopts ":a:b:h" opt; do\n    case $opt in\n        a) arg_a="$OPTARG";;\n        b) arg_b="$OPTARG";;\n        h) usage; exit 0;;\n        \\?) echo "Invalid option: -$OPTARG"; exit 1;;\n        :) echo "Option -$OPTARG requires argument"; exit 1;;\n    esac\ndone', display: '参数解析', description: 'Bash getopts 参数解析', category: 'Shell/Bash' },
  'curl': { text: 'curl -X POST "https://api.example.com/endpoint" \\\n     -H "Content-Type: application/json" \\\n     -H "Authorization: Bearer $TOKEN" \\\n     -d \'{"key": "value"}\' \\\n     --silent | jq .', display: 'cURL 请求', description: 'cURL API 请求模板', category: 'Shell/Bash' },
  'gitinit': { text: 'git init\n\ngit add .\ngit commit -m "Initial commit"\ngit remote add origin <repository-url>\ngit push -u origin main', display: 'Git 初始化', description: 'Git 项目初始化流程', category: 'Git' },
  'gitbranch': { text: '# 创建并切换到新分支\ngit checkout -b feature/new-feature\n\n# 或者使用新语法\ngit switch -c feature/new-feature\n\n# 推送分支到远程\ngit push -u origin feature/new-feature', display: 'Git 分支', description: 'Git 分支管理', category: 'Git' },
  'gitmerge': { text: '# 合并分支到当前分支\ngit merge feature/branch-name\n\n# 合并后删除本地分支\ngit branch -d feature/branch-name\n\n# Squash 合并\ngit merge --squash feature/branch-name', display: 'Git 合并', description: 'Git 分支合并', category: 'Git' },
  'gitrebase': { text: '# 交互式变基（最近3次提交）\ngit rebase -i HEAD~3\n\n# 变基到主分支\ngit rebase main\n\n# 取消变基\ngit rebase --abort', display: 'Git Rebase', description: 'Git 变基操作', category: 'Git' },
  'gitcherry': { text: '# Cherry-pick 单个提交\ngit cherry-pick commit-hash\n\n# Cherry-pick 多个提交（不含最后一个）\ngit cherry-pick start-commit..end-commit\n\n# Cherry-pick 不含提交信息\ngit cherry-pick -n commit-hash', display: 'Cherry-pick', description: 'Git 选择性合并', category: 'Git' },
  'gitstash': { text: '# 暂存当前更改\ngit stash push -m "Work in progress"\n\n# 查看暂存列表\ngit stash list\n\n# 恢复暂存\ngit stash pop stash@{0}\n\n# 应用暂存但不删除\ngit stash apply stash@{0}', display: 'Git Stash', description: 'Git 暂存管理', category: 'Git' },
  'gittag': { text: '# 创建标签\ngit tag -a v1.0.0 -m "Release version 1.0.0"\n\n# 推送标签到远程\ngit push origin v1.0.0\n\n# 推送所有标签\ngit push origin --tags\n\n# 删除标签（本地+远程）\ngit tag -d v1.0.0 && git push origin :refs/tags/v1.0.0', display: 'Git Tag', description: 'Git 标签管理', category: 'Git' },
  'gitreset': { text: '# Soft reset（保留修改在暂存区）\ngit reset --soft HEAD~1\n\n# Mixed reset（保留修改在工作区）\ngit reset --mixed HEAD~1\n\n# Hard reset（完全丢弃修改）\ngit reset --hard HEAD~1\n\n# 回退到指定提交\ngit reset --hard commit-hash', display: 'Git Reset', description: 'Git 重置操作', category: 'Git' },
  'gitrevert': { text: '# Revert 特定提交（创建新的反转提交）\ngit revert commit-hash\n\n# Revert 多个提交范围\ngit revert start-commit..end-commit\n\n# Revert 时不自动提交\ngit revert --no-commit commit-hash', display: 'Git Revert', description: 'Git 反转提交', category: 'Git' },
  'gitbisect': { text: '# 开始二分查找\ngit bisect start\ngit bisect bad          # 当前版本有问题\ngit bisect good abc1234   # 这个版本正常\n\n# Git 会自动切换版本，标记 good/bad\n# 直到找到问题提交\ngit bisect reset         # 结束查找', display: 'Git Bisect', description: 'Git 二分查找示例', category: 'Git' },
  'gitconfig': { text: '[user]\n    name = Your Name\n    email = your.email@example.com\n[core]\n    editor = code --wait\n    autocrlf = input\n[alias]\n    co = checkout\n    br = branch\n    ci = commit\n    st = status\n    lg = log --oneline --graph --all\n[pull]\n    rebase = true', display: 'Git Config', description: 'Git 配置文件模板', category: 'Git' },
  'gitignore': { text: '# Dependencies\nnode_modules/\nvenv/\n__pycache__/\n\n# Build\ndist/\nbuild/\n*.exe\n*.dll\n\n# IDE\n.vscode/\n.idea/\n*.swp\n*.swo\n\n# OS\n.DS_Store\nThumbs.db\n\n# Env\n.env\n.env.local\n*.env\n\n# Logs\nlogs/\n*.log\nnpm-debug.log*', display: '.gitignore', description: 'Git 忽略文件模板', category: 'Git' },
  'mdheader': { text: '# Title\n\n## Subtitle\n\n### Section\n\n---\n\nContent here.', display: 'Markdown 标题', description: 'Markdown 标题层级', category: 'Markdown' },
  'mdlist': { text: '- Item 1\n- Item 2\n  - Nested item\n  - Another nested\n- Item 3\n\n1. Ordered item 1\n2. Ordered item 2\n3. Ordered item 3', display: 'Markdown 列表', description: 'Markdown 有序无序列表', category: 'Markdown' },
  'mdcode': { text: '```language\ncode block here\n```\n\nInline `code` example.', display: 'Markdown 代码', description: 'Markdown 代码块和行内代码', category: 'Markdown' },
  'mdlink': { text: '[Link Text](https://example.com)\n\n![Image Alt](image-url.png "Title")\n\n<email@example.com>', display: 'Markdown 链接', description: 'Markdown 链接、图片、邮件', category: 'Markdown' },
  'mdtable': { text: '| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n\n*Table caption*', display: 'Markdown 表格', description: 'Markdown 表格格式', category: 'Markdown' },
  'mdquote': { text: '> Blockquote text\n> \n> Multiple lines\n> \n> > Nested quote', display: '引用块', description: 'Markdown 引用块', category: 'Markdown' },
  'mdtask': { text: '- [ ] Task 1\n- [x] Completed task\n- [ ] Task 3', display: '任务列表', description: 'Markdown 任务清单', category: 'Markdown' },
  'mdnote': { text: '> [!NOTE]\n> Useful information that users should know, even when skimming.\n\n> [!WARNING]\n> Urgent info that needs immediate user attention to avoid problems.\n\n> [!TIP]\n> Helpful information that helps users be more successful.\n\n> [!IMPORTANT]\n> Key information users need to know to achieve their goal.', display: '提示框', description: 'Markdown Admonition 提示框', category: 'Markdown' },
  'vuecomponent': { text: '<template>\n  <div class="component-name">\n    <!-- template -->\n  </div>\n</template>\n\n<script setup>\nimport { ref, computed, onMounted } from \'vue\'\n\nconst props = defineProps({\n  propName: {\n    type: String,\n    default: \'\'\n  }\n})\n\nconst emit = defineEmits([\'event-name\'])\n\nconst state = ref(null)\n\nonMounted(() => {\n  // initialization\n})\n</script>\n\n<style scoped>\n.component-name {\n  /* styles */\n}\n</style>', display: 'Vue 组件', description: 'Vue 3 Composition API 组件', category: 'Framework' },
  'angular': { text: '@Component({\n  selector: \'app-component\',\n  templateUrl: \'./component.component.html\',\n  styleUrls: [\'./component.component.scss\'],\n  standalone: true,\n  imports: [CommonModule]\n})\nexport class Component implements OnInit {\n  // properties\n\n  ngOnInit(): void {\n    // initialization\n  }\n}', display: 'Angular 组件', description: 'Angular Standalone 组件', category: 'Framework' },
  'express': { text: 'const express = require(\'express\');\nconst app = express();\n\napp.use(express.json());\n\napp.get(\'/api/resource\', async (req, res) => {\n  try {\n    const data = await fetchData();\n    res.json(data);\n  } catch (error) {\n    res.status(500).json({ error: error.message });\n  }\n});\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(`Server running on port ${PORT}`));', display: 'Express 服务', description: 'Node.js Express REST API', category: 'Node.js' },
  'middleware': { text: 'const middleware = (req, res, next) => {\n  // Pre-processing\n  console.log(`${req.method} ${req.url}`);\n  \n  if (!req.headers.authorization) {\n    return res.status(401).json({ error: \'Unauthorized\' });\n  }\n  \n  req.user = decodeToken(req.headers.authorization);\n  next();\n};\n\napp.use(middleware);', display: '中间件', description: 'Express 中间件模式', category: 'Node.js' },
  'dockerfile': { text: 'FROM node:18-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:18-alpine AS runner\nWORKDIR /app\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nCOPY --from=builder /app/package.json ./package.json\nEXPOSE 3000\nCMD ["node", "dist/index.js"]', display: 'Dockerfile', description: 'Node.js Docker 多阶段构建', category: 'DevOps' },
  'dockercompose': { text: 'version: \'3.8\'\n\nservices:\n  app:\n    build: .\n    ports:\n      - "3000:3000"\n    environment:\n      - NODE_ENV=production\n      - DATABASE_URL=postgres://user:pass@db:5432/db\n    depends_on:\n      - db\n    restart: unless-stopped\n  \n  db:\n    image: postgres:15-alpine\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n    environment:\n      - POSTGRES_DB=database\n      - POSTGRES_USER=user\n      - POSTGRES_PASSWORD=password\n\nvolumes:\n  pgdata:', display: 'Docker Compose', description: 'Docker Compose 编排文件', category: 'DevOps' },
  'ci': { text: 'name: CI Pipeline\n\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: \'18\'\n          cache: \'npm\'\n      - run: npm ci\n      - run: npm run lint\n      - run: npm test\n      - run: npm run build', display: 'CI 流水线', description: 'GitHub Actions CI 配置', category: 'DevOps' },
  'regex': { text: '// Email validation\nconst emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n\n// Phone number (international)\nconst phoneRegex = /^\\+?[1-9]\\d{1,14}$/;\n\n// URL validation\nconst urlRegex = /^https?:\\/\\/[^\\s/$.?#].[^\\s]*$/;\n\n// Password strength (min 8 chars, 1 upper, 1 lower, 1 number, 1 special)\nconst passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$/;\n\n// UUID\nconst uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;', display: '正则表达式', description: '常用正则表达式集合', category: 'Utility' },
  'debounce': { text: 'function debounce(fn, delay = 300) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n}', display: '防抖', description: 'Debounce 防抖函数', category: 'Utility' },
  'throttle': { text: 'function throttle(fn, limit = 100) {\n  let inThrottle;\n  return (...args) => {\n    if (!inThrottle) {\n      fn(...args);\n      inThrottle = true;\n      setTimeout(() => inThrottle = false, limit);\n    }\n  };\n}', display: '节流', description: 'Throttle 节流函数', category: 'Utility' },
  'deepclone': { text: 'function deepClone(obj) {\n  if (obj === null || typeof obj !== \'object\') return obj;\n  \n  if (obj instanceof Date) return new Date(obj.getTime());\n  if (obj instanceof Array) return obj.map(item => deepClone(item));\n  if (obj instanceof Object) {\n    const clonedObj = {};\n    for (const key in obj) {\n      if (obj.hasOwnProperty(key)) {\n        clonedObj[key] = deepClone(obj[key]);\n      }\n    }\n    return clonedObj;\n  }\n}', display: '深拷贝', description: 'Deep Clone 深拷贝函数', category: 'Utility' },
  'formatdate': { text: 'function formatDate(date, locale = \'zh-CN\', options = {}) {\n  const defaultOptions = {\n    year: \'numeric\',\n    month: \'long\',\n    day: \'numeric\',\n    hour: \'2-digit\',\n    minute: \'2-digit\',\n    ...options\n  };\n  return new Intl.DateTimeFormat(locale, defaultOptions).format(date);\n}', display: '日期格式化', description: '国际化日期格式化', category: 'Utility' },
  'formatnum': { text: 'function formatNumber(num, locale = \'zh-CN\', options = {}) {\n  const defaultOptions = {\n    style: \'decimal\',\n    minimumFractionDigits: 2,\n    maximumFractionDigits: 2,\n    ...options\n  };\n  return new Intl.NumberFormat(locale, defaultOptions).format(num);\n}\n\n// Usage examples:\n// formatNumber(1234567.89) → "1,234,567.89"\n// formatNumber(0.95, \'en-US\', { style: \'percent\' }) → "95%"', display: '数字格式化', description: '国际化数字格式化', category: 'Utility' },
  'localstorage': { text: 'const storage = {\n  set(key, value) {\n    try {\n      localStorage.setItem(key, JSON.stringify(value));\n    } catch (e) {\n      console.error(\'Storage error:\', e);\n    }\n  },\n  \n  get(key, defaultValue = null) {\n    try {\n      const item = localStorage.getItem(key);\n      return item ? JSON.parse(item) : defaultValue;\n    } catch (e) {\n      console.error(\'Storage parse error:\', e);\n      return defaultValue;\n    }\n  },\n  \n  remove(key) {\n    localStorage.removeItem(key);\n  },\n  \n  clear() {\n    localStorage.clear();\n  }\n};', display: 'LocalStorage', description: 'LocalStorage 封装工具', category: 'Utility' },
  'eventbus': { text: 'class EventBus {\n  constructor() {\n    this.events = {};\n  }\n  \n  on(event, callback) {\n    if (!this.events[event]) this.events[event] = [];\n    this.events[event].push(callback);\n    return () => this.off(event, callback);\n  }\n  \n  off(event, callback) {\n    if (!this.events[event]) return;\n    this.events[event] = this.events[event].filter(cb => cb !== callback);\n  }\n  \n  emit(event, ...args) {\n    if (!this.events[event]) return;\n    this.events[event].forEach(callback => callback(...args));\n  }\n  \n  once(event, callback) {\n    const wrapper = (...args) => {\n      callback(...args);\n      this.off(event, wrapper);\n    };\n    this.on(event, wrapper);\n  }\n}\n\nexport default new EventBus();', display: '事件总线', description: 'EventBus 发布订阅模式', category: 'Pattern' },
  'singleton': { text: 'class Singleton {\n  static instance = null;\n  \n  constructor() {\n    if (Singleton.instance) {\n      return Singleton.instance;\n    }\n    this.data = {};\n    Singleton.instance = this;\n  }\n  \n  static getInstance() {\n    if (!Singleton.instance) {\n      Singleton.instance = new Singleton();\n    }\n    return Singleton.instance;\n  }\n}', display: '单例模式', description: 'Singleton 设计模式', category: 'Pattern' },
  'observer': { text: 'class Subject {\n  constructor() {\n    this.observers = new Set();\n  }\n  \n  subscribe(observer) {\n    this.observers.add(observer);\n    return () => this.unsubscribe(observer);\n  }\n  \n  unsubscribe(observer) {\n    this.observers.delete(observer);\n  }\n  \n  notify(data) {\n    this.observers.forEach(observer => observer.update(data));\n  }\n}\n\nclass Observer {\n  update(data) {\n    console.log(\'Received:\', data);\n  }\n}', display: '观察者模式', description: 'Observer 设计模式', category: 'Pattern' },
  'factory': { text: 'class Factory {\n  create(type, config) {\n    switch (type) {\n      case \'A\':\n        return new ProductA(config);\n      case \'B\':\n        return new ProductB(config);\n      default:\n        throw new Error(`Unknown type: ${type}`);\n    }\n  }\n}\n\nclass ProductA {\n  constructor(config) { /* ... */ }\n}\n\nclass ProductB {\n  constructor(config) { /* ... */ }\n}', display: '工厂模式', description: 'Factory 设计模式', category: 'Pattern' },
  'strategy': { text: 'class Context {\n  constructor(strategy) {\n    this.strategy = strategy;\n  }\n  \n  setStrategy(strategy) {\n    this.strategy = strategy;\n  }\n  \n  execute(data) {\n    return this.strategy.execute(data);\n  }\n}\n\nclass StrategyA {\n  execute(data) {\n    // Implementation A\n  }\n}\n\nclass StrategyB {\n  execute(data) {\n    // Implementation B\n  }\n}\n}', display: '策略模式', description: 'Strategy 设计模式', category: 'Pattern' },
};

export { CODE_SNIPPETS };

const TYPE_ICONS: Record<AutocompleteType, string> = {
  text: '📝',
  command: '⚡',
  context: '📎',
  code: '💻',
};

const TYPE_LABELS: Record<AutocompleteType, string> = {
  text: '文本',
  command: '命令',
  context: '引用',
  code: '代码',
};

const CATEGORY_ICONS: Record<string, string> = {
  'JavaScript': '⚙️',
  'React': '⚛️',
  'Python': '🐍',
  'Go': '🔵',
  'HTML/CSS': '🌐',
  'SQL': '🗄️',
  'Shell/Bash': '💻',
  'Git': '📦',
  'Markdown': '📝',
  'Framework': '🏗️',
  'Node.js': '🟢',
  'DevOps': '🐳',
  'Utility': '🛠️',
  'Pattern': '🧩',
};

const TabAutocomplete: React.FC<TabAutocompleteProps> = ({
  visible,
  items,
  selectedIndex,
  onSelect,
  onNavigate,
  onClose,
  position,
  textareaRef
}) => {
  const [typedChars, setTypedChars] = useState('');

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
          onSelect(items[selectedIndex]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        onNavigate((selectedIndex + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        onNavigate((selectedIndex - 1 + items.length) % items.length);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
          onSelect(items[selectedIndex]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [visible, items, selectedIndex, onSelect, onNavigate, onClose]);

  if (!visible || items.length === 0) return null;

  const groupedItems = useMemo(() => {
    const groups: Record<string, AutocompleteItem[]> = {};
    
    items.forEach(item => {
      let category = '其他';
      if (item.type === 'code') {
        import('./TabAutocomplete').then(({ CODE_SNIPPETS: snippets }) => {
          Object.entries(snippets).forEach(([key, snippet]) => {
            if (snippet.text === item.text) {
              category = snippet.category;
            }
          });
        }).catch(() => {});
      }
      
      const key = `${item.type}-${category}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  }, [items]);

  let offsetIndex = 0;

  return (
    <div
      className="tab-autocomplete"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: position.left || 0,
        marginBottom: '8px',
        width: '420px',
        maxHeight: '400px',
        background: 'var(--glass-bg, rgba(30,30,35,0.98))',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
        borderRadius: '12px',
        overflow: 'hidden',
        zIndex: 10000,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animation: 'scaleIn 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="tab-autocomplete-header" style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-color, var(--border))',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        letterSpacing: '0.5px',
        textTransform: 'uppercase'
      }}>
        <span style={{ opacity: 0.7 }}>✨</span>
        <span>智能补全 ({items.length} 个)</span>
        <span style={{ marginLeft: 'auto', opacity: 0.5, fontWeight: 400 }}>
          ↑↓ 切换 · Tab/Enter 确认 · Esc 关闭
        </span>
      </div>

      <div className="tab-autocomplete-list" style={{
        overflowY: 'auto',
        padding: '4px'
      }}>
        {Object.entries(groupedItems).map(([groupKey, groupItems], gi) => {
          const groupElements = groupItems.map((item, idx) => {
            const currentIndex = offsetIndex + idx;
            const isSelected = currentIndex === selectedIndex;

            return (
              <button
                key={`${groupKey}-${idx}`}
                className={`tab-autocomplete-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(item)}
                onMouseEnter={() => onNavigate(currentIndex)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '9px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--text)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  fontSize: '13px',
                  lineHeight: '1.4'
                }}
              >
                <span style={{
                  fontSize: '16px',
                  flexShrink: 0,
                  width: '22px',
                  textAlign: 'center'
                }}>
                  {item.icon || TYPE_ICONS[item.type]}
                </span>

                <div style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{
                      fontWeight: isSelected ? 600 : 500,
                      fontSize: '13px'
                    }}>
                      {item.display}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg2)',
                      color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-dim)'
                    }}>
                      {TYPE_LABELS[item.type]}
                    </span>
                  </div>

                  {item.description && (
                    <span style={{
                      fontSize: '11px',
                      color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {item.description}
                    </span>
                  )}
                </div>

                {(currentIndex === selectedIndex) && (
                  <span style={{
                    fontSize: '11px',
                    color: isSelected ? 'rgba(255,255,255,0.6)' : 'var(--accent)',
                    flexShrink: 0
                  }}>↵</span>
                )}
              </button>
            );
          });

          offsetIndex += groupItems.length;

          return (
            <div key={groupKey}>
              {groupElements}
              {gi < Object.keys(groupedItems).length - 1 && (
                <div key={`divider-${gi}`} style={{
                  height: '1px',
                  background: 'var(--border-color, var(--border))',
                  margin: '4px 8px',
                  opacity: 0.5
                }} />
              )}
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <div className="tab-autocomplete-footer" style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border-color, var(--border))',
          fontSize: '11px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{items.length} 个建议</span>
          <kbd style={{
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'var(--bg2)',
            border: '1px solid var(--border-color, var(--border))',
            fontSize: '10px',
            fontFamily: 'inherit'
          }}>Tab</kbd>
        </div>
      )}
    </div>
  );
};

export default TabAutocomplete;
export type { AutocompleteItem, AutocompleteType };