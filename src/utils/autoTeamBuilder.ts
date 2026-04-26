import { useStore, AIModelConfig } from '../store/useStore';

const COLORS = ['bg-blue-100', 'bg-green-100', 'bg-purple-100', 'bg-yellow-100', 'bg-pink-100', 'bg-indigo-100'];

export const generateTeamForTask = async (task: string, onProgress?: (msg: string) => void) => {
  const store = useStore.getState();
  const { globalConfig, setAIConfigs, setError } = store;

  if (!globalConfig.apiKey) {
    setError('自动组建团队需要使用大模型，请先在左侧配置【全局 API Key】');
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
    let url = globalConfig.apiUrl;
    if (!url.includes('chat/completions') && !url.includes('/v1/messages')) {
       url += url.endsWith('/') ? 'v1/chat/completions' : '/v1/chat/completions';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${globalConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: globalConfig.model,
        messages: [{ role: 'user', content: systemPrompt }],
        stream: false,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(()=>({}));
      throw new Error(errData.error?.message || `HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    let jsonStr = data.choices[0].message.content;
    
    // Clean markdown code block syntax if the AI still outputs it
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let teamConfigs: any[];
    try {
      const parsed = JSON.parse(jsonStr);
      // Sometimes AI wraps it in an object like { "team": [...] }
      teamConfigs = Array.isArray(parsed) ? parsed : (parsed.team || parsed.roles || parsed.agents || []);
      if (!Array.isArray(teamConfigs)) throw new Error("Invalid format");
    } catch (e) {
      console.error("Parse JSON failed:", jsonStr);
      throw new Error("AI 返回的团队格式不正确，无法解析。");
    }
    
    const newAiConfigs: AIModelConfig[] = teamConfigs.map((c, index) => ({
      id: Date.now().toString() + index,
      name: c.name || `角色 ${index + 1}`,
      rolePrompt: c.rolePrompt || '你是一个 AI 助手。',
      isDecisionMaker: !!c.isDecisionMaker,
      apiUrl: '',
      apiKey: '',
      model: '',
      color: COLORS[index % COLORS.length]
    }));

    // Ensure at least one decision maker
    if (newAiConfigs.length > 0 && !newAiConfigs.some(c => c.isDecisionMaker)) {
      newAiConfigs[newAiConfigs.length - 1].isDecisionMaker = true;
    }

    setAIConfigs(newAiConfigs);
    return true;
  } catch (err: any) {
    console.error('Auto Team Builder Error:', err);
    setError('自动组建团队失败: ' + err.message);
    return false;
  }
};
