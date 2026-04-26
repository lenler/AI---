import React, { useState } from 'react';
import { useStore, AIModelConfig } from '../store/useStore';
import { Plus, Trash2, Settings, User, Globe, PanelLeftClose } from 'lucide-react';

const COLORS = ['bg-blue-100', 'bg-green-100', 'bg-purple-100', 'bg-yellow-100', 'bg-pink-100', 'bg-indigo-100'];

export const Sidebar: React.FC<{ sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void }> = ({ sidebarOpen, setSidebarOpen }) => {
  const { aiConfigs, addAIConfig, updateAIConfig, removeAIConfig, globalConfig, setGlobalConfig } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGlobalExpanded, setIsGlobalExpanded] = useState(true);

  const handleAdd = () => {
    addAIConfig({
      name: '新AI角色',
      rolePrompt: '你是一个乐于助人的AI助手。',
      apiUrl: '',
      apiKey: '',
      model: '',
      isDecisionMaker: false,
      color: COLORS[aiConfigs.length % COLORS.length]
    });
  };

  return (
    <div className={`${sidebarOpen ? 'w-80 border-r border-gray-200' : 'w-0 border-r-0 opacity-0'} transition-all duration-300 ease-in-out shrink-0 h-screen bg-gray-50/80 flex flex-col relative z-30 overflow-hidden`}>
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-600" />
          AI 角色配置
        </h2>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleAdd}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="手动添加AI角色"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            title="收起侧边栏"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        
        {/* Global Config Section */}
        <div className="bg-white border border-blue-100 rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
          <div 
            className="p-3.5 flex justify-between items-center cursor-pointer bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
            onClick={() => setIsGlobalExpanded(!isGlobalExpanded)}
          >
            <div className="flex items-center gap-2 text-blue-800">
              <Globe className="w-4 h-4" />
              <span className="font-semibold text-sm">全局 API 配置</span>
            </div>
            <div className="text-xs text-blue-700 bg-white/60 px-2.5 py-1 rounded-full shadow-sm border border-blue-100">
              推荐
            </div>
          </div>
          
          <div className={`transition-all duration-300 ease-in-out ${isGlobalExpanded ? 'max-h-[300px] opacity-100 p-4' : 'max-h-0 opacity-0 p-0 overflow-hidden'}`}>
            <p className="text-xs text-gray-500 mb-3">配置全局 API 后，下方的角色可留空 API 字段自动继承。</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Global API URL</label>
                <input 
                  type="text" 
                  value={globalConfig.apiUrl}
                  onChange={(e) => setGlobalConfig({ apiUrl: e.target.value })}
                  className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Global API Key</label>
                <input 
                  type="password" 
                  value={globalConfig.apiKey}
                  onChange={(e) => setGlobalConfig({ apiKey: e.target.value })}
                  className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Global 模型名称</label>
                <input 
                  type="text" 
                  value={globalConfig.model}
                  onChange={(e) => setGlobalConfig({ model: e.target.value })}
                  className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="gpt-4o"
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI List */}
        <div className="space-y-3">
          {aiConfigs.map((ai) => (
            <div key={ai.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
              <div 
                className="p-3.5 flex justify-between items-center cursor-pointer hover:bg-gray-50/80 transition-colors"
                onClick={() => setEditingId(editingId === ai.id ? null : ai.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${ai.color.replace('bg-', 'bg-').replace('100', '100')} flex items-center justify-center border border-gray-100 shadow-inner`}>
                    <User className={`w-4 h-4 ${ai.color.replace('bg-', 'text-').replace('100', '600')}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm text-gray-800">{ai.name}</span>
                    {ai.isDecisionMaker && (
                      <span className="text-[10px] text-amber-600 font-medium">最终决策者</span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeAIConfig(ai.id); }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {editingId === ai.id && (
                <div className="p-4 pt-0 border-t border-gray-100 space-y-3 mt-2 bg-gray-50/50">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">名称</label>
                    <input 
                      type="text" 
                      value={ai.name}
                      onChange={(e) => updateAIConfig(ai.id, { name: e.target.value })}
                      className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">API URL</label>
                    <input 
                      type="text" 
                      value={ai.apiUrl}
                      onChange={(e) => updateAIConfig(ai.id, { apiUrl: e.target.value })}
                      className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                      placeholder="继承全局配置"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                    <input 
                      type="password" 
                      value={ai.apiKey}
                      onChange={(e) => updateAIConfig(ai.id, { apiKey: e.target.value })}
                      className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                      placeholder="继承全局配置"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">模型名称</label>
                    <input 
                      type="text" 
                      value={ai.model}
                      onChange={(e) => updateAIConfig(ai.id, { model: e.target.value })}
                      className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                      placeholder="继承全局配置"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">角色设定 (Prompt)</label>
                    <textarea 
                      value={ai.rolePrompt}
                      onChange={(e) => updateAIConfig(ai.id, { rolePrompt: e.target.value })}
                      className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all h-24 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input 
                      type="checkbox" 
                      id={`decision-${ai.id}`}
                      checked={ai.isDecisionMaker}
                      onChange={(e) => updateAIConfig(ai.id, { isDecisionMaker: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`decision-${ai.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                      设为最终决策者
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {aiConfigs.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-10 p-6 border-2 border-dashed border-gray-200 rounded-xl">
            暂无配置，请点击右上角添加 AI 角色
          </div>
        )}
      </div>
    </div>
  );
};
