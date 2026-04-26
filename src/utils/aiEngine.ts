import { useStore, AIModelConfig, DagNode } from '../store/useStore';
import { fetchLLMStream } from './llm';
import { agentTools } from './tools';

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

export const startMultiAIAgentWorkflow = async () => {
  const store = useStore.getState();
  const { aiConfigs, globalConfig, task, uploadedFiles, addExecutionLog, setCurrentStep, setFinalResult, setIsDiscussing, setError } = store;

  if (!task || aiConfigs.length === 0) return;

  setIsDiscussing(true);
  setFinalResult('');
  setError(null);
  store.clearExecutionLogs();

  // Role Assignment & Planner setup
  // Built-in Planner doesn't use a specific user AI, it uses the global config directly.
  const getApiConfig = (ai?: AIModelConfig) => {
    if (!ai) {
      return {
        url: globalConfig.apiUrl,
        key: globalConfig.apiKey,
        model: globalConfig.model
      };
    }
    return {
      url: ai.apiUrl || globalConfig.apiUrl,
      key: ai.apiKey || globalConfig.apiKey,
      model: ai.model || globalConfig.model
    };
  };

  let currentContext = `用户核心任务: ${task}\n\n`;
  if (uploadedFiles.length > 0) {
    currentContext += `[系统提示: 用户已上传了 ${uploadedFiles.length} 个文件，文件名为: ${uploadedFiles.map(f => f.name).join(', ')}。如有需要，你可以调用工具读取它们。]\n\n`;
  }

  try {
    // Record user task at the beginning
    addExecutionLog({ type: 'user', agentName: '用户 (我)', content: task });

    // ---------------------------------------------------------
    // 1. Planning Phase (Built-in Planner)
    // ---------------------------------------------------------
    setCurrentStep('planning');
    addExecutionLog({ type: 'thought', agentName: '内置策划师', content: '正在分析任务，分配可用Agent，并制定最佳的执行顺序...' });
    
    const availableAgents = aiConfigs.map(ai => ({
      id: ai.id,
      name: ai.name,
      role: ai.rolePrompt,
      isDecisionMaker: ai.isDecisionMaker
    }));

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

    let plannerContent = '';
    const pConf = getApiConfig(); // Uses global config for the built-in planner
    if (!pConf.key) throw new Error('全局 API Key 缺失，内置策划师无法工作。请在左侧配置全局API Key。');

    await fetchLLMStream(pConf.url, pConf.key, pConf.model, [
      { role: 'system', content: '你是一个严格输出 JSON 的高级策划师。' },
      { role: 'user', content: plannerPrompt }
    ], (chunk) => {
      plannerContent += chunk;
    });

    // Extract JSON from planner response
    const jsonMatch = plannerContent.match(/```json\s*([\s\S]*?)\s*```/) || plannerContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
       throw new Error('内置策划师未能生成有效的JSON执行计划。');
    }
    
    let plan;
    try {
      plan = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (e) {
      throw new Error('解析内置策划师的执行计划失败。');
    }

    if (!plan.nodes || !Array.isArray(plan.nodes) || plan.nodes.length === 0) {
      throw new Error('内置策划师生成的执行序列无效。');
    }

    const sortedNodes = topologicalSort(plan.nodes);
    const sequenceNames = sortedNodes.map((n: DagNode) => aiConfigs.find(a => a.id === n.agentId)?.name || 'Unknown').join(' -> ');
    addExecutionLog({ type: 'result', agentName: '内置策划师', content: `**执行计划制定完成:**\n${plan.reasoning}\n\n**执行顺序:**\n${sequenceNames}` });
    
    currentContext += `【内置策划师的执行计划】:\n${plan.reasoning}\n执行顺序: ${sequenceNames}\n\n`;

    // ---------------------------------------------------------
    // 2. Dynamic Executing Phase (DAG)
    // ---------------------------------------------------------
    setCurrentStep('executing');

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
      if (node.dependsOn && node.dependsOn.length > 0) {
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
      let baseContext = `用户核心任务: ${task}\n\n你的当前专属子任务: ${node.task}\n\n`;
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

      const eConf = getApiConfig(agent);
      if (!eConf.key) throw new Error(`${agent.name} API Key 缺失。请在全局配置中填写或为该角色单独填写。`);

      await fetchLLMStream(eConf.url, eConf.key, eConf.model, execMessages, (chunk, isReasoning) => {
        if (isReasoning) {
          execReasoning += chunk;
        } else {
          execContent += chunk;
          if (isLastStep) {
            useStore.getState().setFinalResult(execContent);
          }
        }
      });

      // Check if the AI tried to call a tool
      const toolMatch = execContent.match(/\[TOOL:read_uploaded_file:(.+?)\]/);
      
      if (toolMatch) {
        const filename = toolMatch[1].trim();
        addExecutionLog({ type: 'action', agentName: agent.name, content: `调用工具 \`read_uploaded_file\` 读取文件: **${filename}**` });
        
        const fileData = agentTools.read_uploaded_file(filename);
        addExecutionLog({ type: 'observation', agentName: 'System', content: `获取到文件内容，长度: ${fileData.length} 字符。正在将内容返回给执行者继续分析...` });
        
        // Re-execute with tool result
        execMessages.push({ role: 'assistant', content: execContent } as any);
        execMessages.push({ role: 'user' as const, content: `工具返回结果 (文件内容):\n\n${fileData}\n\n请基于以上文件内容继续执行你的任务。` });
        
        let secondExecContent = '';
        await fetchLLMStream(eConf.url, eConf.key, eConf.model, execMessages, (chunk, isReasoning) => {
          if (!isReasoning) {
            secondExecContent += chunk;
            if (isLastStep) {
              useStore.getState().setFinalResult(execContent + '\n\n*(读取文件后的继续分析)*:\n' + secondExecContent);
            }
          }
        });
        execContent += `\n\n*(读取文件后的继续分析)*:\n${secondExecContent}`;
      }

      nodeOutputs[node.id] = execContent;
      addExecutionLog({ type: 'result', agentName: agent.name, content: `**初步执行结果:**\n${execContent}` });
      currentContext += `【${agent.name} (${node.task}) 的执行结果】:\n${execContent}\n\n`;
    }

    setCurrentStep('idle');
    addExecutionLog({ type: 'result', agentName: 'System', content: '工作流结束，所有Agent执行完毕。' });

  } catch (error: any) {
    console.error('Workflow Error:', error);
    useStore.getState().setError(error.message || '工作流执行中发生错误');
    setCurrentStep('idle');
  } finally {
    useStore.getState().setIsDiscussing(false);
  }
};
