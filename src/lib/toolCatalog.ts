export type ToolId =
  | 'bot_builder';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  description: string;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'bot_builder',
    label: 'Bot Builder',
    description: 'Official Deriv DBot integration.',
  },
];

export const DEFAULT_ENABLED_TOOLS: ToolId[] = [
  'bot_builder',
];

const TOOL_ID_SET = new Set<ToolId>(TOOL_DEFINITIONS.map((tool) => tool.id));

export function normalizeToolIds(
  toolIds: string[] | null | undefined,
  options?: { fallbackToDefault?: boolean }
): ToolId[] {
  const source = Array.isArray(toolIds)
    ? toolIds
    : options?.fallbackToDefault
      ? DEFAULT_ENABLED_TOOLS
      : [];

  const deduped: ToolId[] = [];
  const seen = new Set<ToolId>();

  for (const id of source) {
    if (!TOOL_ID_SET.has(id as ToolId)) continue;

    const toolId = id as ToolId;
    if (seen.has(toolId)) continue;

    seen.add(toolId);
    deduped.push(toolId);
  }

  return deduped;
}
