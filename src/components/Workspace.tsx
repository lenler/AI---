import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { startMultiAIAgentWorkflow } from '../utils/aiEngine';
import { generateTeamForTask } from '../utils/autoTeamBuilder';
import { Send, Loader2, Copy, CheckCircle2, AlertCircle, Upload, FileText, X, Bot, Sparkles, Network, Wand2, User } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

export const Workspace: React.FC<{ sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void }> = ({ sidebarOpen, setSidebarOpen }) => {
  const { task, setTask, finalResult, isDiscussing, aiConfigs, error, uploadedFiles, executionLogs, addUploadedFile, removeUploadedFile, currentStep } = useStore();
  const [copied, setCopied] = React.useState(false);
  const [isBuildingTeam, setIsBuildingTeam] = React.useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // Auto scroll to bottom only if user hasn't scrolled up
  useEffect(() => {
    if (isAutoScroll) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executionLogs, finalResult, currentStep, isAutoScroll]);

  // Track user scrolling
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // If user is within 100px of the bottom, re-enable auto-scroll
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAutoScroll(isNearBottom);
  };

  const handleStart = () => {
    if (!task.trim()) return;
    if (aiConfigs.length < 1) {
      alert('请至少配置一个AI角色');
      return;
    }
    const hasDecisionMaker = aiConfigs.some(ai => ai.isDecisionMaker);
    if (!hasDecisionMaker && aiConfigs.length > 1) {
      alert('请在左侧配置中勾选一个AI作为“最终决策者”');
      return;
    }
    startMultiAIAgentWorkflow();
    setTask(''); // Clear the input after starting
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isDiscussing && !isBuildingTeam && task.trim()) {
        handleStart();
      }
    }
  };

  const handleAutoTeam = async () => {
    if (!task.trim()) {
      alert('请先输入任务描述');
      return;
    }
    setIsBuildingTeam(true);
    await generateTeamForTask(task);
    setIsBuildingTeam(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        addUploadedFile({ name: file.name, content });
      };
      reader.readAsText(file);
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(finalResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50/50">
      
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {!sidebarOpen && (
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="展开侧边栏"
            >
              <Network className="w-5 h-5" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-200/50">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Agent Workflow</h1>
            <p className="text-gray-500 text-xs font-medium">规划 → 工具调用 → 执行决策</p>
          </div>
        </div>
      </div>

      {/* Main Chat / Content Area */}
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar relative"
      >
        <div className="max-w-4xl mx-auto space-y-8 pb-32">
          
          {/* Welcome Message */}
          {executionLogs.length === 0 && !finalResult && !error && (
            <div className="flex flex-col items-center justify-center h-full mt-32 text-center space-y-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 rounded-3xl flex items-center justify-center mb-2 shadow-inner border border-blue-200">
                <Sparkles className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 tracking-tight">你好，我是你的 Agent 团队</h2>
              <p className="text-gray-500 max-w-md text-base leading-relaxed">
                在下方输入任务，甚至上传文件。我们将为你拆解任务、调用工具读取文件、反思并最终汇总一份完美的答案。
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 text-red-700 animate-in fade-in slide-in-from-bottom-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm mb-1">请求失败</h3>
                <p className="text-sm opacity-90">{error}</p>
                <p className="text-xs mt-2 opacity-75">提示：请检查左侧配置的 API URL 和 API Key 是否正确。</p>
              </div>
            </div>
          )}

          {/* Execution Timeline (Logs) */}
          {executionLogs.length > 0 && (
            <div className="space-y-6">
              {executionLogs.map((log, index) => {
                if (log.type === 'user') {
                  return (
                    <div key={log.id} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 justify-end">
                      <div className="flex-1 max-w-[80%] space-y-1 flex flex-col items-end">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800 text-sm">{log.agentName}</span>
                        </div>
                        <div className="text-[15px] p-4 rounded-2xl rounded-tr-sm shadow-sm bg-blue-600 text-white leading-relaxed whitespace-pre-wrap">
                          {log.content}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200 shadow-sm">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={log.id} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shrink-0 border border-indigo-200 shadow-sm">
                      {log.type === 'observation' ? <FileText className="w-4 h-4 text-indigo-600" /> : <Bot className="w-4 h-4 text-indigo-600" />}
                    </div>
                    
                    {/* Content Bubble */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 text-sm">{log.agentName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          log.type === 'thought' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          log.type === 'action' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          log.type === 'observation' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {log.type === 'thought' ? '思考中...' : 
                           log.type === 'action' ? '调用工具' : 
                           log.type === 'observation' ? '工具返回' : '输出'}
                        </span>
                      </div>
                      
                      <div className={`p-4 rounded-2xl rounded-tl-sm shadow-sm border ${
                        log.type === 'observation' ? 'bg-gray-50 border-gray-200 text-gray-600 font-mono text-[13px]' : 'bg-white border-gray-200 text-gray-800'
                      }`}>
                        <MarkdownRenderer content={log.content} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Status Indicator */}
          {isDiscussing && (
             <div className="flex items-center gap-3 text-gray-500 animate-pulse ml-12">
               <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
               <span className="text-sm font-medium">
                 {currentStep === 'planning' ? '规划者正在分析任务...' : 
                  currentStep === 'executing' ? '执行者正在处理任务并可能调用工具...' : 
                  currentStep === 'finalizing' ? '决策者正在汇总结果...' : 'Agent 思考中...'}
               </span>
             </div>
          )}

          {/* Final Result */}
          {finalResult && !isDiscussing && (
            <div className="mt-10 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  最终输出结果
                </h3>
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors bg-white px-3 py-1.5 rounded-lg border shadow-sm hover:shadow"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? '已复制' : '复制内容'}
                </button>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md border border-gray-200">
                {finalResult ? (
                  <MarkdownRenderer content={finalResult} />
                ) : null}
              </div>
            </div>
          )}
          
      {/* Invisible div for auto-scrolling */}
          <div ref={endOfMessagesRef} className="h-4" />
        </div>
      </div>

      {/* Floating Scroll to Bottom Button */}
      {!isAutoScroll && (
        <button
          onClick={() => {
            setIsAutoScroll(true);
            endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-blue-600 border border-blue-200 shadow-md rounded-full px-4 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-blue-50 transition-all z-30 animate-in fade-in slide-in-from-bottom-2"
        >
          ↓ 滚动到底部
        </button>
      )}

      {/* Input Area (Bottom Fixed) */}
      <div className="bg-white/80 backdrop-blur-md border-t border-gray-200 p-4 shrink-0 z-20">
        <div className="max-w-4xl mx-auto">
          
          {/* Uploaded Files Tags */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {uploadedFiles.map(file => (
                <div key={file.id} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-100 shadow-sm animate-in fade-in zoom-in duration-200">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <button onClick={() => removeUploadedFile(file.id)} className="hover:bg-indigo-200 p-0.5 rounded-full transition-colors ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Box */}
          <div className="relative shadow-lg shadow-blue-900/5 rounded-3xl border border-gray-200 bg-white overflow-hidden focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all duration-300">
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isDiscussing || isBuildingTeam}
              placeholder="发送任务指令给 Agent 团队... (Enter 发送, Shift+Enter 换行)"
              className="w-full min-h-[70px] max-h-[250px] p-5 pb-14 resize-none bg-transparent outline-none disabled:opacity-50 text-gray-800 placeholder:text-gray-400 text-[15px] leading-relaxed custom-scrollbar"
              rows={Math.min(6, task.split('\n').length || 1)}
            />
            
            <div className="absolute bottom-3.5 left-4 flex items-center gap-2">
              <label className="flex items-center justify-center w-9 h-9 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 cursor-pointer transition-colors" title="上传文件供Agent读取">
                <Upload className="w-5 h-5" />
                <input type="file" multiple accept=".txt,.md,.csv,.json" className="hidden" onChange={handleFileUpload} disabled={isDiscussing || isBuildingTeam} />
              </label>
            </div>

            <div className="absolute bottom-3.5 right-4 flex items-center gap-3">
              <button
                onClick={handleAutoTeam}
                disabled={isDiscussing || isBuildingTeam || !task.trim()}
                title="让AI分析任务并自动组建团队角色"
                className="flex items-center gap-1.5 px-4 h-9 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-full hover:from-indigo-100 hover:to-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-bold shadow-sm border border-indigo-100/50"
              >
                {isBuildingTeam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {isBuildingTeam ? '正在组建...' : '自动组建团队'}
              </button>

              <button
                onClick={handleStart}
                disabled={isDiscussing || isBuildingTeam || !task.trim()}
                title="执行当前团队工作流"
                className="bg-blue-600 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {isDiscussing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
              </button>
            </div>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] text-gray-400">Agent 可能会输出不准确的信息，请核实重要内容。</p>
          </div>
        </div>
      </div>
    </div>
  );
};
