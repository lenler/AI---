import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AIModelConfig {
  id: string;
  name: string;
  rolePrompt: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  isDecisionMaker: boolean;
  color: string;
}

export interface DiscussionMessage {
  id: string;
  aiId: string;
  aiName: string;
  content: string;
  color: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  content: string;
}

export interface DagNode {
  id: string;
  agentId: string;
  task: string;
  dependsOn: string[];
}

export interface ExecutionLog {
  id: string;
  type: 'thought' | 'action' | 'observation' | 'result' | 'user';
  content: string;
  agentName: string;
  timestamp: number;
}

export interface GlobalConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

interface AppState {
  globalConfig: GlobalConfig;
  setGlobalConfig: (config: Partial<GlobalConfig>) => void;
  setAIConfigs: (configs: AIModelConfig[]) => void;
  
  aiConfigs: AIModelConfig[];
  task: string;
  discussions: DiscussionMessage[];
  finalResult: string;
  isDiscussing: boolean;
  error: string | null;
  
  // Agent Workflow State
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

  // Agent Actions
  addUploadedFile: (file: Omit<UploadedFile, 'id'>) => void;
  removeUploadedFile: (id: string) => void;
  setCurrentStep: (step: AppState['currentStep']) => void;
  addExecutionLog: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void;
  clearExecutionLogs: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      globalConfig: {
        apiUrl: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: '',
        model: 'deepseek-chat'
      },
      setGlobalConfig: (config) => set((state) => ({
        globalConfig: { ...state.globalConfig, ...config }
      })),
      setAIConfigs: (configs) => set({ aiConfigs: configs }),

      aiConfigs: [],
      task: '',
      discussions: [],
      finalResult: '',
      isDiscussing: false,
      error: null,
      
      uploadedFiles: [],
      currentStep: 'idle',
      executionLogs: [],

      setTask: (task) => set({ task }),
      
      addAIConfig: (config) => set((state) => ({
        aiConfigs: [...state.aiConfigs, { ...config, id: Date.now().toString() }]
      })),
      
      updateAIConfig: (id, config) => set((state) => ({
        aiConfigs: state.aiConfigs.map((ai) => 
          ai.id === id ? { ...ai, ...config } : ai
        )
      })),
      
      removeAIConfig: (id) => set((state) => ({
        aiConfigs: state.aiConfigs.filter((ai) => ai.id !== id)
      })),
      
      setDiscussions: (discussions) => set({ discussions }),
      
      addDiscussion: (message) => set((state) => ({
        discussions: [...state.discussions, message]
      })),
      
      updateDiscussion: (id, content) => set((state) => ({
        discussions: state.discussions.map((msg) => 
          msg.id === id ? { ...msg, content } : msg
        )
      })),
      
      setFinalResult: (finalResult) => set({ finalResult }),
      
      setIsDiscussing: (isDiscussing) => set({ isDiscussing }),
      
      setError: (error) => set({ error }),
      
      clearWorkspace: () => set({ task: '', discussions: [], finalResult: '', error: null, uploadedFiles: [], executionLogs: [], currentStep: 'idle' }),
      
      addUploadedFile: (file) => set((state) => ({
        uploadedFiles: [...state.uploadedFiles, { ...file, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) }]
      })),
      
      removeUploadedFile: (id) => set((state) => ({
        uploadedFiles: state.uploadedFiles.filter((f) => f.id !== id)
      })),
      
      setCurrentStep: (step) => set({ currentStep: step }),
      
      addExecutionLog: (log) => set((state) => ({
        executionLogs: [...state.executionLogs, { ...log, id: Date.now().toString() + Math.random().toString(36).substr(2, 5), timestamp: Date.now() }]
      })),
      
      clearExecutionLogs: () => set({ executionLogs: [] })
    }),
    {
      name: 'multi-ai-storage',
      partialize: (state) => ({ aiConfigs: state.aiConfigs, globalConfig: state.globalConfig }), // Persist configs
    }
  )
);
