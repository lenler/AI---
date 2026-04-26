# Agent 应用架构升级设计方案 (纯前端版) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有的简单多 AI 并发讨论应用，升级为带有“思考-执行-反思”链条和轻量级浏览器工具调用能力的 Agent 应用。

**Architecture:** 重构 Zustand 状态树以支持多阶段执行流 (Plan -> Execute -> Reflect -> Finalize) 和文件上下文。重写 `aiEngine.ts` 的核心调度逻辑，引入基于角色的步骤循环和本地函数模拟的大模型 Tool Calling。

**Tech Stack:** React, Zustand, fetch (ReadableStream), lucide-react, FileReader API

---

### Task 1: 更新状态管理以支持 Agent 工作流和文件上下文

**Files:**
- Modify: `src/store/useStore.ts`

- [ ] **Step 1: 扩展 Zustand Store 接口和初始状态**
在 `useStore.ts` 中，增加针对文件、执行步骤和执行日志的类型定义和状态。

```typescript
export interface UploadedFile {
  id: string;
  name: string;
  content: string;
}

export interface ExecutionLog {
  id: string;
  type: 'thought' | 'action' | 'observation' | 'result';
  content: string;
  agentName: string;
  timestamp: number;
}

interface AppState {
  // 现有状态
  aiConfigs: AIModelConfig[];
  task: string;
  discussions: DiscussionMessage[];
  finalResult: string;
  isDiscussing: boolean;
  error: string | null;
  
  // 新增状态
  uploadedFiles: UploadedFile[];
  currentStep: 'idle' | 'planning' | 'executing' | 'reflecting' | 'finalizing';
  executionLogs: ExecutionLog[];
  
  // Actions
  setTask: (task: string) => void;
  addAIConfig: (config: Omit<AIModelConfig, 'id'>) => void;
  updateAIConfig: (id: string, config: Partial<AIModelConfig>) => void;
  removeAIConfig: (id: string) => void;
  setDiscussions: (discussions: DiscussionMessage[]) => void;
  addDiscussion: (message: DiscussionMessage) => void;
  updateDiscussion: (id: string, content: string) => void;
  setFinalResult: (result: string) => void;
  setIsDiscussing: (isDiscussing: boolean) => void;
  setError: (error: string | null) => void;
  clearWorkspace: () => void;
  
  // 新增 Actions
  addUploadedFile: (file: Omit<UploadedFile, 'id'>) => void;
  removeUploadedFile: (id: string) => void;
  setCurrentStep: (step: AppState['currentStep']) => void;
  addExecutionLog: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void;
  clearExecutionLogs: () => void;
}
```

- [ ] **Step 2: 实现新增的 Actions**
在 `create` 的 `set` 函数中实现这些新方法。

```typescript
      // ... existing initial state
      uploadedFiles: [],
      currentStep: 'idle',
      executionLogs: [],

      // ... existing actions
      
      addUploadedFile: (file) => set((state) => ({
        uploadedFiles: [...state.uploadedFiles, { ...file, id: Date.now().toString() }]
      })),
      
      removeUploadedFile: (id) => set((state) => ({
        uploadedFiles: state.uploadedFiles.filter((f) => f.id !== id)
      })),
      
      setCurrentStep: (step) => set({ currentStep: step }),
      
      addExecutionLog: (log) => set((state) => ({
        executionLogs: [...state.executionLogs, { ...log, id: Date.now().toString(), timestamp: Date.now() }]
      })),
      
      clearExecutionLogs: () => set({ executionLogs: [] }),
      
      clearWorkspace: () => set({ task: '', discussions: [], finalResult: '', error: null, uploadedFiles: [], executionLogs: [], currentStep: 'idle' })
```

### Task 2: 增加本地文件读取工具 (Tool Implementation)

**Files:**
- Create: `src/utils/tools.ts`

- [ ] **Step 1: 实现文件读取工具函数**
创建一个工具集，供 AI 调用。

```typescript
import { useStore } from '../store/useStore';

export const agentTools = {
  read_uploaded_file: (filename: string): string => {
    const { uploadedFiles } = useStore.getState();
    const file = uploadedFiles.find(f => f.name.toLowerCase() === filename.toLowerCase());
    if (file) {
      return file.content;
    }
    return `Error: File '${filename}' not found in uploaded files.`;
  },
  
  // 预留的计算工具示例
  calculate: (expression: string): string => {
    try {
      // 仅用于前端演示的安全计算，实际应用应使用安全的数学库
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${expression}`)();
      return String(result);
    } catch (e) {
      return `Error calculating expression: ${e}`;
    }
  }
};

export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "read_uploaded_file",
      description: "Read the content of a file that the user has uploaded.",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "The exact name of the uploaded file."
          }
        },
        required: ["filename"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Evaluate a mathematical expression.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "A valid JavaScript mathematical expression (e.g., '2 + 2 * 3')."
          }
        },
        required: ["expression"]
      }
    }
  }
];
```

### Task 3: 升级 LLM 请求支持 Tool Calling

**Files:**
- Modify: `src/utils/llm.ts`

- [ ] **Step 1: 扩展 fetchLLMStream 支持 tools 参数和解析 tool_calls**
更新类型和参数。由于流式解析 tool_calls 较复杂，我们先实现对标准非流式 tool_calls 的兼容，或者简单在提示词中要求 AI 输出 JSON。这里我们采用标准 OpenAI `tools` 参数的非流式兜底，或者简单的 System Prompt 约定。

> 注：为了前端实现的可靠性，我们将采用“在 System Prompt 中约定工具输出格式”的轻量级做法，而不是完整的底层 Stream 工具调用解析。

```typescript
// 修改 fetchLLMStream，使其能够检测特殊的工具调用标记
// 这部分代码主要在 aiEngine.ts 中处理，llm.ts 保持通用流式获取即可，无需大改，只需在 aiEngine 中解析特定模式。
```

### Task 4: 重构 Agent 工作流引擎

**Files:**
- Modify: `src/utils/aiEngine.ts`

- [ ] **Step 1: 引入基于角色的单链工作流 (Plan -> Execute -> Reflect -> Finalize)**
完全重写 `startMultiAIDiscussion`。

```typescript
import { useStore } from '../store/useStore';
import { fetchLLMStream } from './llm';
import { agentTools } from './tools';

export const startMultiAIAgentWorkflow = async () => {
  const store = useStore.getState();
  const { aiConfigs, task, uploadedFiles, addExecutionLog, setCurrentStep, setFinalResult, setIsDiscussing, setError } = store;

  if (!task || aiConfigs.length === 0) return;

  setIsDiscussing(true);
  setFinalResult('');
  setError(null);
  store.clearExecutionLogs();

  // 简单的角色划分（实际可由用户在界面指定，此处为了演示自动选取）
  const planner = aiConfigs[0]; 
  const executor = aiConfigs.length > 1 ? aiConfigs[1] : aiConfigs[0];
  const decisionMaker = aiConfigs.find(ai => ai.isDecisionMaker) || aiConfigs[aiConfigs.length - 1];

  let currentContext = `用户任务: ${task}\n`;
  if (uploadedFiles.length > 0) {
    currentContext += `已上传文件列表: ${uploadedFiles.map(f => f.name).join(', ')}\n`;
  }

  try {
    // 1. Planning Phase
    setCurrentStep('planning');
    addExecutionLog({ type: 'thought', agentName: planner.name, content: '正在分析任务并制定执行计划...' });
    
    let planContent = '';
    const planMessages = [
      { role: 'system' as const, content: `${planner.rolePrompt}\n请将用户的任务拆解为具体的执行步骤。` },
      { role: 'user' as const, content: currentContext },
    ];
    
    await fetchLLMStream(planner.apiUrl, planner.apiKey, planner.model, planMessages, (chunk) => {
      planContent += chunk;
    });
    addExecutionLog({ type: 'result', agentName: planner.name, content: `计划制定完成:\n${planContent}` });
    currentContext += `\n执行计划:\n${planContent}\n`;

    // 2. Executing Phase (Simulated Single Step with potential Tool use)
    setCurrentStep('executing');
    addExecutionLog({ type: 'thought', agentName: executor.name, content: '开始根据计划执行任务。我将检查是否需要读取文件...' });

    let execContent = '';
    const execMessages = [
      { role: 'system' as const, content: `${executor.rolePrompt}\n如果你需要读取文件，请输出格式: [TOOL:read_uploaded_file:文件名]。否则直接输出你的执行结果。` },
      { role: 'user' as const, content: currentContext },
    ];

    await fetchLLMStream(executor.apiUrl, executor.apiKey, executor.model, execMessages, (chunk) => {
      execContent += chunk;
    });

    // Simulate Tool Call parsing
    const toolMatch = execContent.match(/\[TOOL:read_uploaded_file:(.+?)\]/);
    if (toolMatch) {
      const filename = toolMatch[1].trim();
      addExecutionLog({ type: 'action', agentName: executor.name, content: `调用工具读取文件: ${filename}` });
      const fileData = agentTools.read_uploaded_file(filename);
      addExecutionLog({ type: 'observation', agentName: 'System', content: `文件内容长度: ${fileData.length} 字符` });
      
      // Re-execute with tool result
      execMessages.push({ role: 'assistant' as const, content: execContent });
      execMessages.push({ role: 'user' as const, content: `工具返回结果:\n${fileData}\n请继续执行。` });
      
      execContent = '';
      await fetchLLMStream(executor.apiUrl, executor.apiKey, executor.model, execMessages, (chunk) => {
        execContent += chunk;
      });
    }

    addExecutionLog({ type: 'result', agentName: executor.name, content: `执行初步完成。` });
    currentContext += `\n初步执行结果:\n${execContent}\n`;

    // 3. Finalizing Phase
    setCurrentStep('finalizing');
    addExecutionLog({ type: 'thought', agentName: decisionMaker.name, content: '正在进行最终的审查和排版整合...' });

    let finalContent = '';
    const finalMessages = [
      { role: 'system' as const, content: decisionMaker.rolePrompt },
      { role: 'user' as const, content: `请基于以下上下文，输出最终给用户的统一答案。\n\n${currentContext}` },
    ];

    await fetchLLMStream(decisionMaker.apiUrl, decisionMaker.apiKey, decisionMaker.model, finalMessages, (chunk) => {
      finalContent += chunk;
      useStore.getState().setFinalResult(finalContent);
    });

    setCurrentStep('idle');
    addExecutionLog({ type: 'result', agentName: decisionMaker.name, content: '任务全部完成。' });

  } catch (error: any) {
    console.error('Workflow Error:', error);
    useStore.getState().setError(error.message || '工作流执行中发生错误');
    setCurrentStep('idle');
  } finally {
    useStore.getState().setIsDiscussing(false);
  }
};
```

### Task 5: 升级 Workspace UI (Timeline & File Upload)

**Files:**
- Modify: `src/components/Workspace.tsx`

- [ ] **Step 1: 添加文件上传 UI 和逻辑**
在输入框下方添加文件上传区域。

```tsx
import { Upload, FileText, X } from 'lucide-react';
// ... inside Workspace component

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        useStore.getState().addUploadedFile({ name: file.name, content });
      };
      reader.readAsText(file);
    });
  };

  // UI for files (place under textarea)
  <div className="mt-2 flex flex-wrap gap-2">
    {useStore.getState().uploadedFiles.map(file => (
      <div key={file.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
        <FileText className="w-3 h-3" />
        <span className="truncate max-w-[150px]">{file.name}</span>
        <button onClick={() => useStore.getState().removeUploadedFile(file.id)} className="hover:text-blue-900">
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
    <label className="flex items-center gap-1 bg-gray-100 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded text-xs cursor-pointer transition-colors">
      <Upload className="w-3 h-3" />
      <span>添加文件</span>
      <input type="file" multiple accept=".txt,.md,.csv,.json" className="hidden" onChange={handleFileUpload} />
    </label>
  </div>
```

- [ ] **Step 2: 渲染 Timeline 执行日志**
替换原来的 `discussions` 瀑布流，使用 `executionLogs` 渲染垂直时间线。

```tsx
// ... inside Workspace content area
        {useStore.getState().executionLogs.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Agent 工作流进度</h3>
            <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
              {useStore.getState().executionLogs.map((log) => (
                <div key={log.id} className="relative pl-6">
                  <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                    log.type === 'thought' ? 'bg-yellow-400' :
                    log.type === 'action' ? 'bg-blue-500' :
                    log.type === 'observation' ? 'bg-green-500' : 'bg-purple-500'
                  }`} />
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-700 text-sm">{log.agentName}</span>
                    <span className="text-xs text-gray-400">
                      {log.type === 'thought' ? '思考中...' : 
                       log.type === 'action' ? '调用工具' : 
                       log.type === 'observation' ? '工具返回' : '结果输出'}
                    </span>
                  </div>
                  <div className="text-gray-600 text-sm bg-white p-3 rounded-lg border shadow-sm">
                    <ReactMarkdown className="prose prose-sm max-w-none">{log.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
```
