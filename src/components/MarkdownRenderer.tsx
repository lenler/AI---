import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Props {
  content: string;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Markdown rendering error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <span className="text-red-500 text-sm">
          [内容渲染出错，可能包含不完整的代码块]
        </span>
      );
    }

    return this.props.children;
  }
}

export const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  if (!content) return <span className="text-gray-400 italic">正在思考...</span>;

  return (
    <ErrorBoundary>
      <div className="prose max-w-none prose-sm sm:prose-base prose-blue prose-pre:bg-gray-50 prose-pre:p-0 prose-pre:border prose-pre:border-gray-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="relative group rounded-lg overflow-hidden my-4">
                  <div className="flex items-center justify-between px-4 py-1.5 bg-gray-100 border-b border-gray-200 text-xs text-gray-500 font-mono">
                    <span>{match[1]}</span>
                  </div>
                  <SyntaxHighlighter
                    {...props}
                    style={oneLight as any}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: '1rem', background: '#fafafa', fontSize: '0.875rem' }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code {...props} className={`${className} bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-mono text-[0.875em] before:content-none after:content-none`}>
                  {children}
                </code>
              );
            }
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </ErrorBoundary>
  );
};
