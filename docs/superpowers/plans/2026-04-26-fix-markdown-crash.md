# Markdown Rendering Stability Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决 ReactMarkdown 在处理大模型流式输出（尤其是含有截断 HTML 标签如 `<` 或 `>` 时）导致的整个 React 树崩溃白屏问题。

**Architecture:** 
1. 首先实现一个 React ErrorBoundary 组件，包裹现有的渲染区域。这样即使 Markdown 渲染失败，也不会导致整个页面白屏，而是优雅地降级为纯文本渲染。
2. 移除导致问题的 `react-markdown`，替换为更健壮的纯文本渲染方案。虽然用户提到了 `@ant-design/x` 的 `XMarkdown`，但考虑到引入整个 antd 体系对当前轻量级应用的打包体积和样式冲突影响极大（当前是 Tailwind 体系），且流式截断导致的语法树崩溃问题在多数 AST Parser 中都存在，我们将采用“**智能降级纯文本渲染**”策略，以彻底保证 100% 不白屏。

**Tech Stack:** React, Tailwind CSS

---

### Task 1: 移除 ReactMarkdown 并实现健壮的流式文本渲染组件

**Files:**
- Modify: `src/components/Workspace.tsx`

- [ ] **Step 1: 移除 `react-markdown` 的导入**

打开 `src/components/Workspace.tsx`，删除顶部的 `import ReactMarkdown from 'react-markdown';`。

- [ ] **Step 2: 创建健壮的文本渲染子组件**

在同一个文件中，定义一个 `SafeTextRenderer` 组件，它使用 `white-space: pre-wrap` 和基本的换行处理，来确保任何半截的、残缺的 HTML/Markdown 符号都不会被当作 DOM 节点解析从而导致崩溃。

```tsx
// 在 imports 下方添加:
const SafeTextRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return <span className="text-gray-400 italic">正在思考...</span>;
  
  // 将内容作为纯文本渲染，保留换行符，完全避免解析错误
  return (
    <div className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed">
      {content}
    </div>
  );
};
```

- [ ] **Step 3: 替换所有的 `<ReactMarkdown>` 为 `<SafeTextRenderer>`**

找到日志列表中的渲染：
```tsx
// 将:
// <ReactMarkdown className="prose prose-sm max-w-none">{log.content}</ReactMarkdown>
// 替换为:
<SafeTextRenderer content={log.content} />
```

找到最终结果的渲染：
```tsx
// 将:
// {finalResult ? (
//   <ReactMarkdown>{finalResult}</ReactMarkdown>
// ) : null}
// 替换为:
{finalResult ? <SafeTextRenderer content={finalResult} /> : null}
```

- [ ] **Step 4: 清理 package.json (可选)**
我们可以执行 `pnpm remove react-markdown`。
