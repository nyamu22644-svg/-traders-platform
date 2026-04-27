import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TOOL_DEFINITIONS, ToolId } from '../../lib/toolCatalog';
import { cn } from '../../lib/utils';

interface Props {
  enabledTools: ToolId[];
  onToggleTool: (toolId: ToolId) => void;
  onMoveTool: (toolId: ToolId, direction: 'up' | 'down') => void;
}

export function ToolConfigurator({ enabledTools, onToggleTool, onMoveTool }: Props) {
  return (
    <div className="space-y-4 pt-4 border-t border-zinc-800">
      <div>
        <h4 className="text-sm font-medium text-zinc-200">Tool Configuration</h4>
        <p className="text-xs text-zinc-500 mt-1">
          Enable modules for this site and reorder how they appear in navigation.
        </p>
      </div>

      <div className="space-y-2">
        {TOOL_DEFINITIONS.map((tool) => {
          const isEnabled = enabledTools.includes(tool.id);
          const position = enabledTools.indexOf(tool.id);

          return (
            <div
              key={tool.id}
              className={cn(
                'rounded-lg border p-3 transition-colors',
                isEnabled ? 'border-zinc-700 bg-zinc-900/70' : 'border-zinc-800 bg-zinc-950/60'
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggleTool(tool.id)}
                  className={cn(
                    'mt-0.5 h-5 w-9 rounded-full relative transition-colors border',
                    isEnabled
                      ? 'bg-emerald-500/80 border-emerald-500/40'
                      : 'bg-zinc-800 border-zinc-700'
                  )}
                  aria-label={`Toggle ${tool.label}`}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform',
                      isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    )}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{tool.label}</p>
                      <p className="text-xs text-zinc-500 mt-1">{tool.description}</p>
                    </div>

                    {isEnabled && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onMoveTool(tool.id, 'up')}
                          disabled={position <= 0}
                          className="h-8 w-8 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Move ${tool.label} up`}
                        >
                          <ChevronUp className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveTool(tool.id, 'down')}
                          disabled={position === -1 || position >= enabledTools.length - 1}
                          className="h-8 w-8 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Move ${tool.label} down`}
                        >
                          <ChevronDown className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
