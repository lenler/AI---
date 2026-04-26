# Auto Team Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个基于全局 API 配置的任务分析器，能够根据用户输入自动分配和创建 Agent 团队角色配置。

**Architecture:** 
1. 在 Zustand store 中引入 `globalConfig` 并更新 fallback 逻辑。
2. 编写 `autoTeamBuilder.ts` 核心逻辑，通过一次特殊的 LLM 调用让其返回包含角色设定的 JSON 数组。
3. 在侧边栏和工作区分别增加全局配置表单和“✨ 自动组建团队”按钮。

**Tech Stack:** React, Zustand, fetch

---

### Task 1: 更新 Zustand 状态树以支持全局配置和重写团队

**Files:**
- Modify: `src/store/useStore.ts`

- [ ] **Step 1: 定义 GlobalConfig 接口和扩展 AppState**

```typescript
export interface GlobalConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

interface AppState {
  // 新增
  globalConfig: GlobalConfig;
  setGlobalConfig: (config: Partial<GlobalConfig>) => void;
  setAIConfigs: (configs: AIModelConfig[]) => void;
  
  // 现有状态...
}
```

- [ ] **Step 2: 实现状态和 Actions**

```typescript
// 在 initial state 中:
globalConfig: {
  apiUrl: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: '',
  model: 'deepseek-chat'
},

// 在 actions 中:
setGlobalConfig: (config) => set((state) => ({
  globalConfig: { ...state.globalConfig, ...config }
})),

setAIConfigs: (configs) => set({ aiConfigs: configs }),

// 更新 partialize 包含 globalConfig
partialize: (state) => ({ aiConfigs: state.aiConfigs, globalConfig: state.globalConfig }),
```

### Task 2: 改造 Sidebar 引入全局配置面板和 Fallback 机制

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/utils/aiEngine.ts`

- [ ] **Step 1: 在 Sidebar 顶部添加全局配置 UI**
增加一个折叠或固定的区域供用户输入统一的 API Key。修改原有的每个 AI 的独立配置表单，说明当留空时默认使用全局配置。

- [ ] **Step 2: 修改 `aiEngine.ts` 中的执行逻辑**
在读取 `aiConfigs` 执行时，如果个别 AI 没有配置 key 或 url，则自动 fallback 到 `globalConfig`。

### Task 3: 编写自动团队生成引擎逻辑

**Files:**
- Create: `src/utils/autoTeamBuilder.ts`

- [ ] **Step 1: 编写生成团队配置的独立方法**

```typescript
import { useStore, AIModelConfig } from '../store/useStore';

const COLORS = ['bg-blue-100', 'bg-green-100', 'bg-purple-100', 'bg-yellow-100', 'bg-pink-100', 'bg-indigo-100'];

export const generateTeamForTask = async (task: string, onProgress?: (msg: string) => void) => {
  const store = useStore.getState();
  const { globalConfig, setAIConfigs, setError } = store;

  if (!globalConfig.apiKey) {
    setError('请先在左侧配置全局 API Key');
    return false;
  }

  onProgress?.('正在呼叫任务分析器...');

  const systemPrompt = `你是一个出色的 Agent 团队架构师。
用户的任务是: "${task}"

请分析这个任务需要怎样的团队协作。你需要为这个任务分配 2-4 个 AI 角色，并明确指定其中1个作为最终的决策者 (Decision Maker)。
请**严格只输出 JSON** 格式，不要包含任何 markdown 代码块标记，不要有任何其他解释文字。JSON 必须是以下数组格式：
[
  {
    "name": "角色名称(如: 创意思考者)",
    "rolePrompt": "详细的角色设定 Prompt...",
    "isDecisionMaker": false
  },
  {
    "name": "总结与决策者",
    "rolePrompt": "你负责最终汇总...",
    "isDecisionMaker": true
  }
]`;

  try {
    const response = await fetch(globalConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${globalConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: globalConfig.model,
        messages: [{ role: 'user', content: systemPrompt }],
        stream: false, // 这里不需要流式，直接获取完整 JSON 即可
        response_format: { type: "json_object" } // DeepSeek 建议开启，或者靠 prompt 约束
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    let jsonStr = data.choices[0].message.content;
    
    // 清理可能存在的 markdown code blocks
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const teamConfigs: any[] = JSON.parse(jsonStr);
    
    // 转换为符合状态树的 AIModelConfig
    const newAiConfigs: AIModelConfig[] = teamConfigs.map((c, index) => ({
      id: Date.now().toString() + index,
      name: c.name || `角色 ${index + 1}`,
      rolePrompt: c.rolePrompt || '你是一个 AI 助手。',
      isDecisionMaker: !!c.isDecisionMaker,
      apiUrl: '', // 留空以使用全局配置
      apiKey: '',
      model: '',
      color: COLORS[index % COLORS.length]
    }));

    setAIConfigs(newAiConfigs);
    return true;
  } catch (err: any) {
    console.error('Auto Team Builder Error:', err);
    setError('自动组建团队失败，可能是 JSON 解析错误或 API 异常: ' + err.message);
    return false;
  }
};
```

### Task 4: 在 Workspace 中增加“自动组建团队”按钮与状态

**Files:**
- Modify: `src/components/Workspace.tsx`

- [ ] **Step 1: 添加按钮与加载状态**
在输入框下方或右侧发送按钮旁边增加一个 `✨ 组建团队` 按钮。点击时禁用输入，显示 Loading，调用 `generateTeamForTask`，完成后恢复。
