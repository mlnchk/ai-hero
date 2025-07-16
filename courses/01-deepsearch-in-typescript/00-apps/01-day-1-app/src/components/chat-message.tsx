import ReactMarkdown, { type Components } from "react-markdown";
import type { Message } from "ai";

export type MessagePart = NonNullable<Message["parts"]>[number];

interface ChatMessageProps {
  parts: MessagePart[];
  role: string;
  userName: string;
}

const components: Components = {
  // Override default elements with custom styling
  p: ({ children }) => <p className="mb-4 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  code: ({ className, children, ...props }) => (
    <code className={`${className ?? ""}`} {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-700 p-4">
      {children}
    </pre>
  ),
  a: ({ children, ...props }) => (
    <a
      className="text-blue-400 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const Markdown = ({ children }: { children: string }) => {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
};

const ToolInvocation = ({ toolInvocation }: { toolInvocation: any }) => {
  return (
    <div className="my-2 rounded bg-gray-700 p-2 text-xs">
      <div className="font-mono text-gray-300">
        <span className="font-bold">[Tool Call]</span> <br />
        <span>
          Tool: <span className="font-semibold">{toolInvocation.toolName}</span>
        </span>
        <br />
        <span>
          State: <span className="font-semibold">{toolInvocation.state}</span>
        </span>
        <br />
        <span>
          Args:{" "}
          <pre className="inline whitespace-pre-wrap">
            {JSON.stringify(toolInvocation.args, null, 2)}
          </pre>
        </span>
        <br />
        {"result" in toolInvocation && toolInvocation.result !== undefined && (
          <span>
            Result:{" "}
            <pre className="inline whitespace-pre-wrap">
              {JSON.stringify(toolInvocation.result, null, 2)}
            </pre>
          </span>
        )}
      </div>
    </div>
  );
};

export const ChatMessage = ({ parts, role, userName }: ChatMessageProps) => {
  const isAI = role === "assistant";

  return (
    <div className="mb-6">
      <div
        className={`rounded-lg p-4 ${
          isAI ? "bg-gray-800 text-gray-300" : "bg-gray-900 text-gray-300"
        }`}
      >
        <p className="mb-2 text-sm font-semibold text-gray-400">
          {isAI ? "AI" : userName}
        </p>
        <div className="prose prose-invert max-w-none">
          <div
            className="mb-2 cursor-help text-xs text-gray-500"
            title="Hover to see all possible MessagePart types: text, tool-invocation, reasoning, source, file, step-start. This UI currently shows text and tool-invocation parts."
          >
            <span>Hover for MessagePart types</span>
          </div>
          {parts.map((part, idx) => {
            if (part.type === "text") {
              return <Markdown key={idx}>{part.text}</Markdown>;
            }
            if (part.type === "tool-invocation") {
              return (
                <ToolInvocation
                  key={idx}
                  toolInvocation={part.toolInvocation}
                />
              );
            }
            // Optionally, handle other part types here in the future
            return null;
          })}
        </div>
      </div>
    </div>
  );
};
