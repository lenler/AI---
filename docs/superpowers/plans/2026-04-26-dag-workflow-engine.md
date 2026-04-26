# DAG Workflow Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the built-in AI planner to generate a Directed Acyclic Graph (DAG) for agent execution, topological sort the graph, and execute the agents sequentially in the UI while passing only relevant dependency contexts.

**Architecture:** 
1. Update `aiEngine.ts` planner prompt to enforce JSON output representing a DAG (nodes with `id`, `agentId`, `task`, `dependsOn`).
2. Implement a topological sort utility function to determine the execution order from the DAG.
3. Modify the execution loop to iterate over the sorted nodes, fetching only the results of their specific dependencies to build their `currentContext`, preventing context pollution.

**Tech Stack:** TypeScript, React, Zustand

---

### Task 1: Update Store and Types for DAG

**Files:**
- Modify: `src/store/useStore.ts`

- [ ] **Step 1: Define DAG Node Interface**

Add the `DagNode` interface to represent a step in the workflow.

```typescript
export interface DagNode {
  id: string;
  agentId: string;
  task: string;
  dependsOn: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/store/useStore.ts
git commit -m "feat: add DagNode interface to store types"
```

### Task 2: Implement Topological Sort Utility

**Files:**
- Modify: `src/utils/aiEngine.ts`

- [ ] **Step 1: Write topological sort function**

Add a helper function inside or above `startMultiAIAgentWorkflow` to sort the DAG nodes.

```typescript
const topologicalSort = (nodes: DagNode[]): DagNode[] => {
  const sorted: DagNode[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (nodeId: string) => {
    if (visiting.has(nodeId)) throw new Error('检测到循环依赖 (Cycle detected in DAG)');
    if (visited.has(nodeId)) return;

    visiting.add(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      node.dependsOn.forEach(depId => visit(depId));
      visiting.delete(nodeId);
      visited.add(nodeId);
      sorted.push(node);
    }
  };

  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      visit(node.id);
    }
  });

  return sorted;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/aiEngine.ts
git commit -m "feat: add topological sort utility for DAG"
```

### Task 3: Update Built-in Planner Prompt

**Files:**
- Modify: `src/utils/aiEngine.ts`

- [ ] **Step 1: Modify the Planner Prompt to request a DAG**

Change the `plannerPrompt` string to enforce the new JSON structure.

```typescript
    const plannerPrompt = `你是一个高级AI任务策划师。
用户的任务是: ${task}
你拥有以下可用的AI助手（Agents）:
${JSON.stringify(availableAgents, null, 2)}

请根据用户任务的复杂度和各个AI助手的职责，制定一个基于有向无环图(DAG)的最佳调用依赖关系。
要求：
1. 决策者（isDecisionMaker: true）必须在最后一步被调用，用于总结和输出最终结果。
2. 你必须输出一段思考过程，然后输出一个严格的JSON格式的执行计划。
3. JSON格式必须包裹在 \`\`\`json 和 \`\`\` 之间。

JSON结构如下:
{
  "reasoning": "解释为什么这样安排依赖关系",
  "nodes": [
    { "id": "A", "agentId": "AI助手的ID", "task": "分配给该助手的具体子任务", "dependsOn": [] },
    { "id": "B", "agentId": "另一个AI助手的ID", "task": "具体子任务", "dependsOn": ["A"] }
  ]
}`;
```

- [ ] **Step 2: Update JSON parsing logic**

Update the parsing logic to extract and validate `nodes`.

```typescript
    if (!plan.nodes || !Array.isArray(plan.nodes) || plan.nodes.length === 0) {
      throw new Error('内置策划师生成的依赖图节点无效。');
    }

    const sortedNodes = topologicalSort(plan.nodes);
    const sequenceNames = sortedNodes.map(n => aiConfigs.find(a => a.id === n.agentId)?.name || 'Unknown').join(' -> ');
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/aiEngine.ts
git commit -m "feat: update planner prompt to generate DAG JSON"
```

### Task 4: Execute Sorted DAG with Dependency Context

**Files:**
- Modify: `src/utils/aiEngine.ts`

- [ ] **Step 1: Rewrite execution loop to use sorted nodes and track outputs**

Replace the `plan.sequence` loop with `sortedNodes`. Store the output of each node to pass only to its dependents.

```typescript
    // Store outputs of each node for dependency injection
    const nodeOutputs: Record<string, string> = {};

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const agent = aiConfigs.find(a => a.id === node.agentId);
      if (!agent) continue;

      const isLastStep = i === sortedNodes.length - 1;
      if (isLastStep) {
        setCurrentStep('finalizing');
      }

      addExecutionLog({ type: 'thought', agentName: agent.name, content: `开始执行阶段任务 [${node.task}] (${i + 1}/${sortedNodes.length})...` });

      // Build context ONLY from dependencies
      let dependencyContext = '';
      if (node.dependsOn.length > 0) {
        dependencyContext = "【前置任务结果】:\n";
        node.dependsOn.forEach(depId => {
          const depNode = plan.nodes.find((n: any) => n.id === depId);
          const depAgent = aiConfigs.find(a => a.id === depNode?.agentId);
          if (depNode && nodeOutputs[depId]) {
            dependencyContext += `--- 来自 ${depAgent?.name || '前置节点'} (${depNode.task}) 的结果 ---\n${nodeOutputs[depId]}\n\n`;
          }
        });
      }

      // Base context
      let baseContext = `用户核心任务: ${task}\n\n你的当前子任务: ${node.task}\n\n`;
      if (uploadedFiles.length > 0) {
        baseContext += `[系统提示: 用户已上传了 ${uploadedFiles.length} 个文件，文件名为: ${uploadedFiles.map(f => f.name).join(', ')}。如有需要，你可以调用工具读取它们。]\n\n`;
      }

      const finalContextForAgent = baseContext + dependencyContext;

      let execContent = '';
      let execReasoning = '';
      const execMessages = [
        { 
          role: 'system' as const, 
          content: `${agent.rolePrompt}\n
你现在的任务是作为团队的一员，根据前置任务的结果执行你的专属子任务。
【工具调用说明】:
如果你需要读取用户上传的文件，你必须严格输出以下格式的代码块（不要输出任何其他多余的描述）：
\`\`\`tool_call
[TOOL:read_uploaded_file:文件名]
\`\`\`
系统会自动截断你的输出，去执行读取文件操作，并将文件内容返回给你。获取内容后你再继续分析。

如果没有文件需要读取，或者文件内容已经获取完毕，请直接输出你的分析和执行结果。` 
        },
        { role: 'user' as const, content: finalContextForAgent },
      ];
```

- [ ] **Step 2: Save node output after stream completes**

Right after the `fetchLLMStream` and tool call resolution finishes for the node, save the result to `nodeOutputs`.

```typescript
      // After fetchLLMStream and tool calls...
      nodeOutputs[node.id] = execContent;
      addExecutionLog({ type: 'result', agentName: agent.name, content: `**初步执行结果:**\n${execContent}` });
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/aiEngine.ts
git commit -m "feat: implement DAG execution loop with dependency context injection"
```