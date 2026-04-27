import React from 'react';
import * as Blockly from 'blockly';
import {
  BellRing,
  Bot,
  ChartCandlestick,
  ChartColumn,
  CircleHelp,
  Download,
  FileCode2,
  FileSpreadsheet,
  FolderInput,
  Gauge,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Upload,
} from 'lucide-react';
import { Site, SiteConfig } from '../../lib/supabase';
import { DerivBotSymbol, useDerivBotMarketData } from './dbot/useDerivBotMarketData';
import { DerivBotProposalRequest, useDerivBotRuntime } from './dbot/useDerivBotRuntime';

interface Props {
  site: Site;
  config: SiteConfig;
  view?: 'dashboard' | 'bot_builder' | 'charts' | 'tutorials';
  authContext?: {
    accessToken?: string;
    accountId?: string;
    loginid?: string;
    currency?: string;
    balance?: number | null;
  };
  launchGuide?: {
    title: string;
    description: string;
    steps: string[];
  } | null;
  onDismissGuide?: () => void;
}

type DbotTab = NonNullable<Props['view']>;
type SummaryTab = 'summary' | 'transactions' | 'journal';
type QuickStrategyId = 'martingale' | 'dalembert' | 'oscars-grind';

interface ImportedStrategy {
  fileName: string;
  xml: string;
  blockCount: number;
  blockTypes: string[];
}

interface WorkspaceStats {
  blockCount: number;
  topBlocks: number;
  xml: string;
}

interface QuickStrategy {
  id: QuickStrategyId;
  title: string;
  description: string;
}

const TABS: Array<{ id: DbotTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'bot_builder', label: 'Bot Builder', icon: Bot },
  { id: 'charts', label: 'Charts', icon: ChartCandlestick },
  { id: 'tutorials', label: 'Tutorials', icon: FileSpreadsheet },
];

const QUICK_STRATEGIES: QuickStrategy[] = [
  {
    id: 'martingale',
    title: 'Martingale',
    description: 'Increase the stake after a loss and reset after a win.',
  },
  {
    id: 'dalembert',
    title: "D'Alembert",
    description: 'Adjust stake gradually after losses and wins.',
  },
  {
    id: 'oscars-grind',
    title: "Oscar's Grind",
    description: 'Increase stake only after wins until the cycle target is reached.',
  },
];

const TOOLBOX_MENU = [
  { id: 'trade_parameters', label: 'Trade parameters', position: 0 },
  { id: 'purchase_conditions', label: 'Purchase conditions', position: 1 },
  { id: 'sell_conditions', label: 'Sell conditions (optional)', position: 2 },
  { id: 'trade_results', label: 'Restart trading conditions', position: 3 },
  { id: 'analysis', label: 'Analysis', position: 4 },
  { id: 'utility', label: 'Utility', position: 5 },
  { id: 'logic', label: 'Logic', position: 7 },
  { id: 'math', label: 'Math', position: 8 },
  { id: 'text', label: 'Text', position: 9 },
  { id: 'variables', label: 'Variables', position: 10 },
] as const;

const TRADE_SYMBOL_OPTIONS = [
  ['Volatility 10 (1s) Index', '1HZ10V'],
  ['Volatility 25 (1s) Index', '1HZ25V'],
  ['Volatility 50 Index', 'R_50'],
  ['Volatility 100 Index', 'R_100'],
];

let builderBlocksRegistered = false;
let builderThemeRegistered = false;
const WORKSPACE_STORAGE_PREFIX = 'traders_platform_dbot_workspace';

function formatServerClock(date: Date | null) {
  if (!date) return '--:--:-- GMT';

  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} GMT`;
}

function formatQuote(value: number | null | undefined, pipSize = 0.001) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';

  const decimals = pipSize >= 1 ? 2 : Math.max(2, String(pipSize).split('.')[1]?.length || 3);
  return value.toFixed(decimals);
}

function buildSparklinePath(points: number[], width: number, height: number) {
  if (!points.length) return '';
  if (points.length === 1) return `M 0 ${height / 2} L ${width} ${height / 2}`;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function parseImportedStrategy(fileName: string, xml: string): ImportedStrategy {
  const blockTypes = Array.from(xml.matchAll(/type="([^"]+)"/g))
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);

  return {
    fileName,
    xml,
    blockCount: blockTypes.length,
    blockTypes: Array.from(new Set(blockTypes)).slice(0, 12),
  };
}

function filterFeaturedSymbols(symbols: DerivBotSymbol[]) {
  const preferred = ['1HZ100V', 'R_100', 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'cryBTCUSD'];
  const index = new Map(symbols.map(symbol => [symbol.symbol, symbol]));
  const picked = preferred.map(symbol => index.get(symbol)).filter((symbol): symbol is DerivBotSymbol => Boolean(symbol));

  if (picked.length >= 6) return picked;
  return symbols.slice(0, 8);
}

function getBuilderTheme() {
  if (!builderThemeRegistered) {
    Blockly.Theme.defineTheme('trader_dbot', {
      name: 'trader_dbot',
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: '#ffffff',
        toolboxBackgroundColour: '#f4f4f6',
        toolboxForegroundColour: '#222222',
        flyoutBackgroundColour: '#ffffff',
        flyoutForegroundColour: '#1e1e1e',
        flyoutOpacity: 1,
        scrollbarColour: '#c1c5ce',
        insertionMarkerColour: '#2f7ff6',
        insertionMarkerOpacity: 0.3,
        scrollbarOpacity: 0.4,
        cursorColour: '#2f7ff6',
      },
      categoryStyles: {
        trade_category: { colour: '#0c607f' },
        purchase_category: { colour: '#0f6a8d' },
        sell_category: { colour: '#106b8b' },
        restart_category: { colour: '#165f80' },
        analysis_category: { colour: '#1e6e8f' },
        utility_category: { colour: '#1e5f88' },
        logic_category: { colour: '#3f6cd8' },
        math_category: { colour: '#8358c5' },
        text_category: { colour: '#2a8d74' },
        variable_category: { colour: '#a55a1f' },
      },
      blockStyles: {
        trade_blocks: {
          colourPrimary: '#0c607f',
          colourSecondary: '#0a5570',
          colourTertiary: '#094d66',
        },
        purchase_blocks: {
          colourPrimary: '#0f6a8d',
          colourSecondary: '#0d617f',
          colourTertiary: '#0b5874',
        },
        sell_blocks: {
          colourPrimary: '#106b8b',
          colourSecondary: '#0e617f',
          colourTertiary: '#0c5973',
        },
        restart_blocks: {
          colourPrimary: '#165f80',
          colourSecondary: '#135570',
          colourTertiary: '#114d67',
        },
        analysis_blocks: {
          colourPrimary: '#1e6e8f',
          colourSecondary: '#1a637f',
          colourTertiary: '#175a73',
        },
        utility_blocks: {
          colourPrimary: '#1e5f88',
          colourSecondary: '#1a5579',
          colourTertiary: '#164d6d',
        },
      },
      fontStyle: {
        family: 'Segoe UI, Arial, sans-serif',
        weight: '600',
        size: 12,
      },
      startHats: false,
    });
    builderThemeRegistered = true;
  }

  return Blockly.Themes['trader_dbot'];
}

function registerBuilderBlocks() {
  if (builderBlocksRegistered) return;

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'trade_market_block',
      message0: 'Market %1 Category %2 Symbol %3',
      args0: [
        {
          type: 'field_dropdown',
          name: 'MARKET',
          options: [
            ['Derived', 'derived'],
            ['Forex', 'forex'],
            ['Crypto', 'crypto'],
          ],
        },
        {
          type: 'field_dropdown',
          name: 'CATEGORY',
          options: [
            ['Continuous indices', 'continuous'],
            ['Majors', 'majors'],
            ['Cryptocurrencies', 'coins'],
          ],
        },
        {
          type: 'field_dropdown',
          name: 'SYMBOL',
          options: TRADE_SYMBOL_OPTIONS,
        },
      ],
      nextStatement: null,
      style: 'trade_blocks',
    },
    {
      type: 'trade_parameters_block',
      message0: 'Trade type %1 Contract %2 Duration %3 %4 Stake %5',
      args0: [
        {
          type: 'field_dropdown',
          name: 'TRADE_TYPE',
          options: [
            ['Rise/Fall', 'rise_fall'],
            ['Higher/Lower', 'higher_lower'],
            ['Digits', 'digits'],
          ],
        },
        {
          type: 'field_dropdown',
          name: 'CONTRACT',
          options: [
            ['Both', 'both'],
            ['Call', 'call'],
            ['Put', 'put'],
          ],
        },
        {
          type: 'field_number',
          name: 'DURATION',
          value: 5,
          min: 1,
        },
        {
          type: 'field_dropdown',
          name: 'DURATION_UNIT',
          options: [
            ['ticks', 'ticks'],
            ['minutes', 'minutes'],
            ['hours', 'hours'],
          ],
        },
        {
          type: 'field_number',
          name: 'STAKE',
          value: 1,
          min: 0.35,
          precision: 0.01,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      style: 'trade_blocks',
    },
      {
        type: 'purchase_condition_block',
        message0: 'Purchase when %1',
        args0: [
          {
            type: 'input_value',
            name: 'CONDITION',
            check: 'Boolean',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        style: 'purchase_blocks',
    },
    {
      type: 'sell_condition_block',
      message0: 'if %1 then sell',
      args0: [
        {
          type: 'input_value',
          name: 'CONDITION',
          check: 'Boolean',
        },
      ],
      previousStatement: null,
      nextStatement: null,
      style: 'sell_blocks',
    },
    {
      type: 'restart_condition_block',
      message0: 'Trade again after %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'MODE',
          options: [
            ['both win and loss', 'both'],
            ['win only', 'win'],
            ['loss only', 'loss'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      style: 'restart_blocks',
    },
    {
      type: 'analysis_last_digit_block',
      message0: 'Last digit is %1',
      args0: [
        {
          type: 'field_number',
          name: 'DIGIT',
          value: 7,
          min: 0,
          max: 9,
          precision: 1,
        },
      ],
      output: 'Boolean',
      style: 'analysis_blocks',
    },
    {
      type: 'analysis_ticks_block',
      message0: 'Last %1 ticks show %2',
      args0: [
        {
          type: 'field_number',
          name: 'COUNT',
          value: 5,
          min: 1,
          precision: 1,
        },
        {
          type: 'field_dropdown',
          name: 'DIRECTION',
          options: [
            ['uptrend', 'up'],
            ['downtrend', 'down'],
            ['sideways', 'flat'],
          ],
        },
      ],
      output: 'Boolean',
      style: 'analysis_blocks',
    },
    {
      type: 'utility_notify_block',
      message0: 'Notify %1',
      args0: [
        {
          type: 'field_input',
          name: 'MESSAGE',
          text: 'Cycle completed',
        },
      ],
      previousStatement: null,
      nextStatement: null,
      style: 'utility_blocks',
    },
    {
      type: 'utility_set_stake_block',
      message0: 'Set next stake to %1',
      args0: [
        {
          type: 'field_number',
          name: 'STAKE',
          value: 1,
          min: 0.35,
          precision: 0.01,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      style: 'utility_blocks',
    },
  ]);

  builderBlocksRegistered = true;
}

function getToolboxDefinition() {
  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: 'Trade parameters',
        categorystyle: 'trade_category',
        contents: [
          { kind: 'block', type: 'trade_market_block' },
          { kind: 'block', type: 'trade_parameters_block' },
        ],
      },
      {
        kind: 'category',
        name: 'Purchase conditions',
        categorystyle: 'purchase_category',
        contents: [{ kind: 'block', type: 'purchase_condition_block' }],
      },
      {
        kind: 'category',
        name: 'Sell conditions (optional)',
        categorystyle: 'sell_category',
        contents: [{ kind: 'block', type: 'sell_condition_block' }],
      },
      {
        kind: 'category',
        name: 'Restart trading conditions',
        categorystyle: 'restart_category',
        contents: [{ kind: 'block', type: 'restart_condition_block' }],
      },
      {
        kind: 'category',
        name: 'Analysis',
        categorystyle: 'analysis_category',
        contents: [
          { kind: 'block', type: 'analysis_last_digit_block' },
          { kind: 'block', type: 'analysis_ticks_block' },
          { kind: 'block', type: 'logic_compare' },
          { kind: 'block', type: 'logic_operation' },
        ],
      },
      {
        kind: 'category',
        name: 'Utility',
        categorystyle: 'utility_category',
        contents: [
          { kind: 'block', type: 'utility_notify_block' },
          { kind: 'block', type: 'utility_set_stake_block' },
          { kind: 'block', type: 'controls_if' },
          { kind: 'block', type: 'math_number' },
        ],
      },
      {
        kind: 'sep',
      },
      {
        kind: 'category',
        name: 'Logic',
        categorystyle: 'logic_category',
        contents: [
          { kind: 'block', type: 'controls_if' },
          { kind: 'block', type: 'logic_compare' },
          { kind: 'block', type: 'logic_operation' },
          { kind: 'block', type: 'logic_boolean' },
        ],
      },
      {
        kind: 'category',
        name: 'Math',
        categorystyle: 'math_category',
        contents: [
          { kind: 'block', type: 'math_number' },
          { kind: 'block', type: 'math_arithmetic' },
          { kind: 'block', type: 'math_single' },
        ],
      },
      {
        kind: 'category',
        name: 'Text',
        categorystyle: 'text_category',
        contents: [
          { kind: 'block', type: 'text' },
          { kind: 'block', type: 'text_join' },
        ],
      },
      {
        kind: 'category',
        name: 'Variables',
        custom: 'VARIABLE',
        categorystyle: 'variable_category',
      },
    ],
  };
}

function connectSequentialBlocks(blocks: Blockly.Block[]) {
  for (let index = 0; index < blocks.length - 1; index += 1) {
    const current = blocks[index];
    const next = blocks[index + 1];
    if (current.nextConnection && next.previousConnection) {
      current.nextConnection.connect(next.previousConnection);
    }
  }
}

function connectValueInput(parent: Blockly.Block, inputName: string, child: Blockly.Block) {
  const input = parent.getInput(inputName);
  if (input?.connection && child.outputConnection) {
    input.connection.connect(child.outputConnection);
  }
}

function loadQuickStrategy(workspace: Blockly.WorkspaceSvg, strategyId: QuickStrategyId) {
  workspace.clear();

  const market = workspace.newBlock('trade_market_block');
  market.initSvg();
  market.render();
  market.moveBy(60, 40);

  const parameters = workspace.newBlock('trade_parameters_block');
  parameters.initSvg();
  parameters.render();

  const purchase = workspace.newBlock('purchase_condition_block');
  purchase.initSvg();
  purchase.render();

  const restart = workspace.newBlock('restart_condition_block');
  restart.initSvg();
  restart.render();

  const notify = workspace.newBlock('utility_notify_block');
  notify.initSvg();
  notify.render();

  const analysis = strategyId === 'martingale'
    ? workspace.newBlock('analysis_last_digit_block')
    : workspace.newBlock('analysis_ticks_block');
  analysis.initSvg();
  analysis.render();

  const sellAnalysis = strategyId === 'martingale'
    ? workspace.newBlock('analysis_last_digit_block')
    : workspace.newBlock('analysis_ticks_block');
  sellAnalysis.initSvg();
  sellAnalysis.render();

  const sell = workspace.newBlock('sell_condition_block');
  sell.initSvg();
  sell.render();

  if (strategyId === 'martingale') {
    parameters.setFieldValue('rise_fall', 'TRADE_TYPE');
    parameters.setFieldValue('call', 'CONTRACT');
    parameters.setFieldValue(1, 'STAKE');
    notify.setFieldValue('Martingale cycle loaded', 'MESSAGE');
    restart.setFieldValue('loss', 'MODE');
    analysis.setFieldValue(7, 'DIGIT');
    sellAnalysis.setFieldValue(2, 'DIGIT');
  } else if (strategyId === 'dalembert') {
    parameters.setFieldValue('call', 'CONTRACT');
    parameters.setFieldValue(2, 'STAKE');
    notify.setFieldValue("D'Alembert cycle loaded", 'MESSAGE');
    restart.setFieldValue('both', 'MODE');
    analysis.setFieldValue(6, 'COUNT');
    analysis.setFieldValue('up', 'DIRECTION');
    sellAnalysis.setFieldValue(4, 'COUNT');
    sellAnalysis.setFieldValue('down', 'DIRECTION');
  } else {
    parameters.setFieldValue('call', 'CONTRACT');
    parameters.setFieldValue(1, 'STAKE');
    notify.setFieldValue("Oscar's Grind cycle loaded", 'MESSAGE');
    restart.setFieldValue('win', 'MODE');
    analysis.setFieldValue(4, 'COUNT');
    analysis.setFieldValue('up', 'DIRECTION');
    sellAnalysis.setFieldValue(3, 'COUNT');
    sellAnalysis.setFieldValue('down', 'DIRECTION');
  }

  connectValueInput(purchase, 'CONDITION', analysis);
  connectValueInput(sell, 'CONDITION', sellAnalysis);

  connectSequentialBlocks([market, parameters, purchase, sell, restart, notify]);
  Blockly.svgResize(workspace);
}

function downloadXml(xml: string, fileName: string) {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildProposalFromWorkspace(
  workspace: Blockly.WorkspaceSvg | null,
  fallbackCurrency: string,
  stakeOverride?: number | null
): DerivBotProposalRequest {
  if (!workspace) {
    throw new Error('Bot workspace is not ready.');
  }

  const marketBlock = workspace.getAllBlocks(false).find(block => block.type === 'trade_market_block');
  const parametersBlock = workspace.getAllBlocks(false).find(block => block.type === 'trade_parameters_block');

  if (!marketBlock || !parametersBlock) {
    throw new Error('Add Trade parameters blocks before running the bot.');
  }

  const symbol = String(marketBlock.getFieldValue('SYMBOL') || '').trim();
  const amount = typeof stakeOverride === 'number' && Number.isFinite(stakeOverride)
    ? stakeOverride
    : Number(parametersBlock.getFieldValue('STAKE') || 0);
  const duration = Number(parametersBlock.getFieldValue('DURATION') || 0);
  const durationUnit = String(parametersBlock.getFieldValue('DURATION_UNIT') || 'ticks').trim();
  const contractSelection = String(parametersBlock.getFieldValue('CONTRACT') || '').trim();

  const contractTypeMap: Record<string, string> = {
    call: 'CALL',
    put: 'PUT',
  };

  const contractType = contractTypeMap[contractSelection];

  if (!symbol) throw new Error('Select a symbol before running the bot.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Stake must be greater than zero.');
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Duration must be greater than zero.');
  if (!contractType) {
    throw new Error('Select a specific contract direction such as Call or Put before running.');
  }

  return {
    symbol,
    currency: fallbackCurrency || 'USD',
    amount,
    duration,
    durationUnit,
    contractType,
  };
}

function getBaseStakeFromWorkspace(workspace: Blockly.WorkspaceSvg | null) {
  if (!workspace) return 0;
  const parametersBlock = workspace.getAllBlocks(false).find(block => block.type === 'trade_parameters_block');
  return Number(parametersBlock?.getFieldValue('STAKE') || 0);
}

function getInputBlock(block: Blockly.Block | null | undefined, inputName: string) {
  if (!block) return null;
  return block.getInputTargetBlock(inputName);
}

function getLatestQuoteNumber(latestQuote: number | null | undefined) {
  return typeof latestQuote === 'number' && Number.isFinite(latestQuote) ? latestQuote : null;
}

function evaluateBlockValue(
  block: Blockly.Block | null,
  context: {
    latestQuote: number | null;
    ticks: Array<{ quote: number }>;
  }
): boolean | number | string | null {
  if (!block) return null;

  switch (block.type) {
    case 'analysis_last_digit_block': {
      const quote = context.latestQuote;
      if (quote === null) return false;
      const normalized = String(quote).replace('.', '');
      const lastDigit = Number(normalized[normalized.length - 1] || '0');
      return lastDigit === Number(block.getFieldValue('DIGIT') || 0);
    }

    case 'analysis_ticks_block': {
      const count = Math.max(1, Number(block.getFieldValue('COUNT') || 1));
      const direction = String(block.getFieldValue('DIRECTION') || 'flat');
      const quotes = context.ticks.slice(-count).map(entry => entry.quote);
      if (quotes.length < 2) return false;

      const delta = quotes[quotes.length - 1] - quotes[0];
      if (direction === 'up') return delta > 0;
      if (direction === 'down') return delta < 0;
      return delta === 0;
    }

    case 'logic_boolean':
      return String(block.getFieldValue('BOOL') || 'FALSE').toUpperCase() === 'TRUE';

    case 'math_number':
      return Number(block.getFieldValue('NUM') || 0);

    case 'logic_compare': {
      const op = String(block.getFieldValue('OP') || 'EQ');
      const left = evaluateBlockValue(getInputBlock(block, 'A'), context);
      const right = evaluateBlockValue(getInputBlock(block, 'B'), context);
      const a = typeof left === 'number' ? left : Number(left);
      const b = typeof right === 'number' ? right : Number(right);

      switch (op) {
        case 'EQ': return a === b;
        case 'NEQ': return a !== b;
        case 'LT': return a < b;
        case 'LTE': return a <= b;
        case 'GT': return a > b;
        case 'GTE': return a >= b;
        default: return false;
      }
    }

    case 'logic_operation': {
      const op = String(block.getFieldValue('OP') || 'AND');
      const left = Boolean(evaluateBlockValue(getInputBlock(block, 'A'), context));
      const right = Boolean(evaluateBlockValue(getInputBlock(block, 'B'), context));
      return op === 'OR' ? left || right : left && right;
    }

    default:
      return null;
  }
}

function evaluateWorkspaceCondition(
  workspace: Blockly.WorkspaceSvg | null,
  blockType: 'purchase_condition_block' | 'sell_condition_block',
  context: {
    latestQuote: number | null;
    ticks: Array<{ quote: number }>;
  }
) {
  if (!workspace) return false;
  const conditionBlock = workspace.getAllBlocks(false).find(block => block.type === blockType) || null;
  if (!conditionBlock) return false;
  const inputBlock = getInputBlock(conditionBlock, blockType === 'purchase_condition_block' ? 'CONDITION' : 'CONDITION');
  const result = evaluateBlockValue(inputBlock, context);
  return Boolean(result);
}

function getRestartMode(workspace: Blockly.WorkspaceSvg | null) {
  if (!workspace) return 'both';
  const restartBlock = workspace.getAllBlocks(false).find(block => block.type === 'restart_condition_block') || null;
  return String(restartBlock?.getFieldValue('MODE') || 'both');
}

export function BotBuilderTool({ site, view = 'dashboard', authContext }: Props) {
  const [activeTab, setActiveTab] = React.useState<DbotTab>(view);
  const [summaryTab, setSummaryTab] = React.useState<SummaryTab>('summary');
  const [activeToolboxCategory, setActiveToolboxCategory] = React.useState<number>(0);
  const [toolboxSearch, setToolboxSearch] = React.useState('');
  const [isToolboxOpen, setIsToolboxOpen] = React.useState(true);
  const [importedStrategy, setImportedStrategy] = React.useState<ImportedStrategy | null>(null);
  const [selectedQuickStrategyId, setSelectedQuickStrategyId] = React.useState<QuickStrategyId | null>(null);
  const [workspaceStats, setWorkspaceStats] = React.useState<WorkspaceStats>({
    blockCount: 0,
    topBlocks: 0,
    xml: '',
  });
  const [currentStake, setCurrentStake] = React.useState<number | null>(null);
  const [activityLog, setActivityLog] = React.useState<string[]>([
    'Bot builder initialized.',
    'Waiting for strategy import or quick strategy selection.',
  ]);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const blocklyContainerRef = React.useRef<HTMLDivElement | null>(null);
  const workspaceRef = React.useRef<Blockly.WorkspaceSvg | null>(null);
  const workspaceRestoredRef = React.useRef(false);
  const lastAutoRunSignatureRef = React.useRef<string>('');
  const soldContractIdsRef = React.useRef(new Set<string>());
  const settledContractIdsRef = React.useRef(new Set<string>());

  const {
    connectionState,
    latestTick,
    lastError,
    selectedSymbol,
    serverTime,
    setSelectedSymbol,
    symbols,
    ticks,
  } = useDerivBotMarketData();

  const workspaceStorageKey = React.useMemo(
    () => `${WORKSPACE_STORAGE_PREFIX}:${site.id}`,
    [site.id]
  );

  const {
    connectionState: runtimeConnectionState,
    isRunning,
    runtimeError,
    lastProposal,
    activeContract,
    transactions,
    balance,
    portfolio,
    connect,
    runOnce,
    sellOpenContract,
  } = useDerivBotRuntime({
    accessToken: authContext?.accessToken,
    accountId: authContext?.accountId,
  });

  React.useEffect(() => {
    setActiveTab(view);
  }, [view]);

  const selectedQuickStrategy = React.useMemo(
    () => QUICK_STRATEGIES.find(strategy => strategy.id === selectedQuickStrategyId) || null,
    [selectedQuickStrategyId]
  );

  const featuredSymbols = React.useMemo(() => filterFeaturedSymbols(symbols), [symbols]);
  const selectedSymbolMeta = React.useMemo(
    () => symbols.find(symbol => symbol.symbol === selectedSymbol) || featuredSymbols[0] || null,
    [featuredSymbols, selectedSymbol, symbols]
  );

  const sparklinePath = React.useMemo(
    () => buildSparklinePath(ticks.map(point => point.quote), 620, 160),
    [ticks]
  );

  const appendActivity = React.useCallback((entry: string) => {
    setActivityLog(previous => [entry, ...previous].slice(0, 12));
  }, []);

  React.useEffect(() => {
    if (runtimeError) {
      appendActivity(`Runtime error: ${runtimeError}`);
    }
  }, [appendActivity, runtimeError]);

  React.useEffect(() => {
    const baseStake = getBaseStakeFromWorkspace(workspaceRef.current);
    if (baseStake > 0) {
      setCurrentStake(current => (current && current > 0 ? current : baseStake));
    }
  }, [workspaceStats.xml]);

  React.useEffect(() => {
    if (activeTab !== 'bot_builder' || !authContext?.accessToken || !authContext?.accountId) return;
    void connect().catch(() => {});
  }, [activeTab, authContext?.accessToken, authContext?.accountId, connect]);

  React.useEffect(() => {
    registerBuilderBlocks();
    getBuilderTheme();
  }, []);

  React.useEffect(() => {
    if (activeTab !== 'bot_builder' || !blocklyContainerRef.current || workspaceRef.current) return;

    const workspace = Blockly.inject(blocklyContainerRef.current, {
      toolbox: getToolboxDefinition(),
      theme: getBuilderTheme(),
      trashcan: true,
      move: {
        drag: true,
        wheel: true,
        scrollbars: {
          horizontal: true,
          vertical: true,
        },
      },
      zoom: {
        controls: false,
        wheel: false,
        startScale: 0.9,
        maxScale: 1.6,
        minScale: 0.4,
        scaleSpeed: 1.1,
        pinch: true,
      },
      grid: {
        spacing: 24,
        length: 2,
        colour: '#e7eaf0',
        snap: false,
      },
      sounds: false,
    }) as Blockly.WorkspaceSvg;

    workspaceRef.current = workspace;

    const syncWorkspaceState = () => {
      if (!workspaceRef.current) return;
      const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspaceRef.current));
      setWorkspaceStats({
        blockCount: workspaceRef.current.getAllBlocks(false).length,
        topBlocks: workspaceRef.current.getTopBlocks(false).length,
        xml,
      });
    };

    workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) return;
      syncWorkspaceState();
    });

    const handleResize = () => {
      if (workspaceRef.current) Blockly.svgResize(workspaceRef.current);
    };

    window.addEventListener('resize', handleResize);
    syncWorkspaceState();
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [activeTab]);

  React.useEffect(() => {
    if (!workspaceRef.current || workspaceRestoredRef.current) return;

    const savedXml = window.localStorage.getItem(workspaceStorageKey);
    if (!savedXml) {
      workspaceRestoredRef.current = true;
      return;
    }

    try {
      const dom = Blockly.utils.xml.textToDom(savedXml);
      workspaceRef.current.clear();
      Blockly.Xml.domToWorkspace(dom, workspaceRef.current);
      Blockly.svgResize(workspaceRef.current);
      appendActivity('Restored saved workspace from local storage.');
    } catch {
      window.localStorage.removeItem(workspaceStorageKey);
    } finally {
      workspaceRestoredRef.current = true;
    }
  }, [appendActivity, workspaceStorageKey]);

  React.useEffect(() => {
    if (!workspaceStats.xml) return;
    window.localStorage.setItem(workspaceStorageKey, workspaceStats.xml);
  }, [workspaceStats.xml, workspaceStorageKey]);

  React.useEffect(() => {
    if (activeTab === 'bot_builder' && workspaceRef.current) {
      Blockly.svgResize(workspaceRef.current);
    }
  }, [activeTab, summaryTab]);

  const selectToolboxCategory = React.useCallback((position: number) => {
    const toolbox = workspaceRef.current?.getToolbox() as {
      getToolboxItems?: () => unknown[];
      setSelectedItem?: (item: unknown | null) => void;
    } | null;

    const items = toolbox?.getToolboxItems?.() || [];
    if (!items[position]) return;

    toolbox?.setSelectedItem?.(items[position]);
    setActiveToolboxCategory(position);
  }, []);

  React.useEffect(() => {
    if (activeTab !== 'bot_builder' || !workspaceRef.current) return;
    selectToolboxCategory(activeToolboxCategory);
  }, [activeTab, activeToolboxCategory, selectToolboxCategory]);

  const handleImportClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const xml = await file.text();
    const parsed = parseImportedStrategy(file.name, xml);

    setImportedStrategy(parsed);
    setSelectedQuickStrategyId(null);
    setActiveTab('bot_builder');

    window.setTimeout(() => {
      const workspace = workspaceRef.current;
      if (!workspace) return;

      try {
        const dom = Blockly.utils.xml.textToDom(xml);
        workspace.clear();
        Blockly.Xml.domToWorkspace(dom, workspace);
        Blockly.svgResize(workspace);
        appendActivity(`Imported XML strategy: ${file.name}`);
      } catch {
        appendActivity(`Failed to load XML strategy: ${file.name}`);
      }
    }, 0);

    event.target.value = '';
  }, [appendActivity]);

  const handleQuickStrategyPick = React.useCallback((strategyId: QuickStrategyId) => {
    const strategy = QUICK_STRATEGIES.find(item => item.id === strategyId);
    if (!strategy) return;

    setSelectedQuickStrategyId(strategy.id);
    setImportedStrategy(null);
    setActiveTab('bot_builder');

    window.setTimeout(() => {
      const workspace = workspaceRef.current;
      if (!workspace) return;
      loadQuickStrategy(workspace, strategyId);
      appendActivity(`Loaded quick strategy: ${strategy.title}`);
    }, 0);
  }, [appendActivity]);

  const handleExportXml = React.useCallback(() => {
    if (!workspaceStats.xml) return;
    downloadXml(workspaceStats.xml, importedStrategy?.fileName || 'traders-platform-dbot.xml');
    appendActivity('Exported workspace as XML.');
  }, [appendActivity, importedStrategy?.fileName, workspaceStats.xml]);

  const handleUndo = React.useCallback(() => {
    workspaceRef.current?.undo(false);
  }, []);

  const handleRedo = React.useCallback(() => {
    workspaceRef.current?.undo(true);
  }, []);

  const handleZoomIn = React.useCallback(() => {
    workspaceRef.current?.zoomCenter(1);
  }, []);

  const handleZoomOut = React.useCallback(() => {
    workspaceRef.current?.zoomCenter(-1);
  }, []);

  const handleCenter = React.useCallback(() => {
    workspaceRef.current?.scrollCenter();
  }, []);

  const handleResetWorkspace = React.useCallback(() => {
    if (!workspaceRef.current) return;

    workspaceRef.current.clear();
    setImportedStrategy(null);
    setSelectedQuickStrategyId(null);
    setCurrentStake(null);
    setActiveToolboxCategory(0);
    lastAutoRunSignatureRef.current = '';
    soldContractIdsRef.current.clear();
    settledContractIdsRef.current.clear();
    appendActivity('Workspace reset.');
    window.setTimeout(() => {
      selectToolboxCategory(0);
      Blockly.svgResize(workspaceRef.current as Blockly.WorkspaceSvg);
    }, 0);
  }, [appendActivity, selectToolboxCategory]);

  const handleRun = React.useCallback(async () => {
    try {
      const effectiveProposal = buildProposalFromWorkspace(
        workspaceRef.current,
        authContext?.currency || 'USD',
        currentStake
      );
      appendActivity(
        `Submitting proposal for ${effectiveProposal.symbol} ${effectiveProposal.contractType} ${effectiveProposal.amount} ${effectiveProposal.currency}.`
      );
      await runOnce(effectiveProposal);
      appendActivity('Run request submitted to Deriv runtime.');
    } catch (error) {
      appendActivity(error instanceof Error ? error.message : 'Could not start the bot run.');
    }
  }, [appendActivity, authContext?.currency, currentStake, runOnce]);

  React.useEffect(() => {
    const quote = getLatestQuoteNumber(latestTick?.quote);
    const workspace = workspaceRef.current;
    if (
      activeTab !== 'bot_builder' ||
      !workspace ||
      !authContext?.accessToken ||
      !authContext?.accountId ||
      isRunning ||
      quote === null
    ) {
      return;
    }

    const activeContractId = String(activeContract?.contract_id || '').trim();
    const contractIsOpen = Boolean(activeContractId) && !Number(activeContract?.is_sold || 0) && !Number(activeContract?.is_expired || 0);

    if (!contractIsOpen) {
      const purchaseAllowed = evaluateWorkspaceCondition(workspace, 'purchase_condition_block', {
        latestQuote: quote,
        ticks,
      });

      const signature = `${latestTick?.epoch || Date.now()}:${quote}`;
      if (purchaseAllowed && lastAutoRunSignatureRef.current !== signature) {
        lastAutoRunSignatureRef.current = signature;
        void (async () => {
          try {
            const proposal = buildProposalFromWorkspace(
              workspace,
              authContext?.currency || 'USD',
              currentStake
            );
            appendActivity(`Auto-run triggered from purchase condition at ${quote}.`);
            await runOnce(proposal);
          } catch (error) {
            appendActivity(error instanceof Error ? error.message : 'Auto-run failed.');
          }
        })();
      }

      return;
    }

    const sellAllowed = evaluateWorkspaceCondition(workspace, 'sell_condition_block', {
      latestQuote: quote,
      ticks,
    });

    if (sellAllowed && activeContractId && !soldContractIdsRef.current.has(activeContractId)) {
      soldContractIdsRef.current.add(activeContractId);
      void (async () => {
        try {
          appendActivity(`Sell condition triggered for contract ${activeContractId}.`);
          await sellOpenContract(activeContractId, 0);
        } catch (error) {
          soldContractIdsRef.current.delete(activeContractId);
          appendActivity(error instanceof Error ? error.message : 'Auto-sell failed.');
        }
      })();
    }
  }, [
    activeContract,
    activeTab,
    appendActivity,
    authContext?.accessToken,
    authContext?.accountId,
    authContext?.currency,
    isRunning,
    latestTick,
    runOnce,
    sellOpenContract,
    ticks,
    currentStake,
  ]);

  React.useEffect(() => {
    const activeContractId = String(activeContract?.contract_id || '').trim();
    if (!activeContractId) return;
    const isClosed = Number(activeContract?.is_sold || 0) || Number(activeContract?.is_expired || 0);
    if (!isClosed) return;
    if (settledContractIdsRef.current.has(activeContractId)) return;

    settledContractIdsRef.current.add(activeContractId);

    const restartMode = getRestartMode(workspaceRef.current);
    const baseStake = getBaseStakeFromWorkspace(workspaceRef.current);
    const profit = Number(activeContract?.profit ?? 0);
    const wasWin = profit > 0;
    const shouldReset =
      restartMode === 'both' ||
      (restartMode === 'win' && wasWin) ||
      (restartMode === 'loss' && !wasWin);

    soldContractIdsRef.current.delete(activeContractId);

    if (baseStake > 0) {
      setCurrentStake(current => {
        const currentValue = current && current > 0 ? current : baseStake;

        if (selectedQuickStrategyId === 'martingale') {
          return wasWin ? baseStake : currentValue * 2;
        }

        if (selectedQuickStrategyId === 'dalembert') {
          return wasWin ? Math.max(baseStake, currentValue - 1) : currentValue + 1;
        }

        if (selectedQuickStrategyId === 'oscars-grind') {
          return wasWin ? currentValue + 1 : baseStake;
        }

        return baseStake;
      });
    }

    if (shouldReset) {
      lastAutoRunSignatureRef.current = '';
      appendActivity(`Restart condition armed after contract ${activeContractId} closed.`);
    }
  }, [activeContract, appendActivity, selectedQuickStrategyId]);

  const runStatusText = workspaceStats.blockCount
    ? authContext?.accessToken
      ? authContext?.accountId
        ? isRunning
          ? 'Submitting order...'
          : runtimeConnectionState === 'open'
            ? 'Connected to Deriv runtime'
            : 'Ready to run'
        : 'Account runtime unavailable'
      : 'Builder ready. Connect account to run'
    : 'Build or import a bot to continue';

  const filteredToolboxMenu = React.useMemo(() => {
    const query = toolboxSearch.trim().toLowerCase();
    if (!query) return TOOLBOX_MENU;
    return TOOLBOX_MENU.filter(item => item.label.toLowerCase().includes(query));
  }, [toolboxSearch]);

  const performanceCurrency = balance?.currency || authContext?.currency || 'AUD';

  const renderDashboard = () => (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f7f7]">
      <div className="flex items-center justify-end px-6 py-4">
        <div className="inline-flex items-center gap-3 rounded-full bg-[#ececef] px-5 py-3 text-[14px] text-[#262626] shadow-sm">
          <BellRing className="h-5 w-5 text-[#202020]" />
          <span>Announcements</span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#ff444f] text-[14px] font-semibold text-white">4</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-12">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-[#1e1e1e]">Load or build your bot</h1>
        <p className="mt-6 max-w-4xl text-center text-[18px] leading-9 text-[#2f2f2f]">
          Import your current bot from your computer, start from a quick strategy, or open the full builder workspace.
        </p>

        <div className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-8 md:grid-cols-4">
          <button
            type="button"
            onClick={handleImportClick}
            className="group flex flex-col items-center rounded-[20px] px-4 py-4 text-center"
          >
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-[20px] bg-[#f0f1f4] text-[#0f648c] transition group-hover:bg-[#e8ebf1]">
              <FolderInput className="h-12 w-12" />
            </div>
            <span className="mt-4 text-[15px] text-[#1f1f1f]">My computer</span>
          </button>

          <button
            type="button"
            onClick={() => appendActivity('Google Drive import is not wired in this repo yet.')}
            className="group flex flex-col items-center rounded-[20px] px-4 py-4 text-center"
          >
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-[20px] bg-[#f0f1f4] text-[#3f74ea] transition group-hover:bg-[#e8ebf1]">
              <FileSpreadsheet className="h-12 w-12" />
            </div>
            <span className="mt-4 text-[15px] text-[#1f1f1f]">Google Drive</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bot_builder')}
            className="group flex flex-col items-center rounded-[20px] px-4 py-4 text-center"
          >
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-[20px] bg-[#f0f1f4] text-[#1677a0] transition group-hover:bg-[#e8ebf1]">
              <Bot className="h-12 w-12" />
            </div>
            <span className="mt-4 text-[15px] text-[#1f1f1f]">Bot builder</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickStrategyPick('martingale')}
            className="group flex flex-col items-center rounded-[20px] px-4 py-4 text-center"
          >
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-[20px] bg-[#f0f1f4] text-[#1b6e90] transition group-hover:bg-[#e8ebf1]">
              <ChartColumn className="h-12 w-12" />
            </div>
            <span className="mt-4 text-[15px] text-[#1f1f1f]">Quick strategy</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderBotBuilder = () => (
    <div className="grid h-full min-h-0 grid-cols-[308px_minmax(0,1fr)_456px] bg-[#f5f6f8]">
      <aside className="flex min-h-0 flex-col border-r border-[#e3e6eb] bg-white p-4">
        <button
          type="button"
          onClick={() => handleQuickStrategyPick(selectedQuickStrategyId || 'martingale')}
          className="flex h-14 items-center justify-center rounded-[8px] bg-[#1218ff] px-5 text-[14px] font-semibold text-white"
        >
          Quick strategy
        </button>

        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden border border-[#edf0f3] bg-[#ffffff]">
          <button
            type="button"
            onClick={() => setIsToolboxOpen(open => !open)}
            className="flex items-center justify-between border-b border-[#edf0f3] bg-[#f6f7f8] px-5 py-4 text-left text-[18px] font-semibold text-[#22262b]"
          >
            <span>Blocks menu</span>
            <span className={`transition-transform ${isToolboxOpen ? 'rotate-180' : ''}`}>⌃</span>
          </button>

          {isToolboxOpen ? (
            <>
              <div className="border-b border-[#edf0f3] px-4 py-4">
                <label className="flex items-center gap-3 rounded-[12px] border border-[#dfe3e8] bg-white px-4 py-3">
                  <Search className="h-5 w-5 text-[#5f6672]" />
                  <input
                    value={toolboxSearch}
                    onChange={event => setToolboxSearch(event.target.value)}
                    placeholder="Search"
                    className="w-full border-none bg-transparent text-[14px] text-[#23262a] outline-none"
                  />
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {filteredToolboxMenu.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectToolboxCategory(item.position)}
                    className={`flex w-full items-center border-b border-[#edf0f3] px-4 py-4 text-left text-[14px] font-semibold ${
                      activeToolboxCategory === item.position
                        ? 'bg-[#f5f6f7] text-[#1c2128]'
                        : 'bg-white text-[#303744]'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col border-r border-[#e3e6eb] bg-white">
        <div className="flex h-14 items-center border-b border-[#e3e6eb] bg-white px-4">
          <div className="flex items-center rounded-[8px] border border-[#dfe3e8]">
            <button type="button" onClick={handleResetWorkspace} title="Reset workspace" className="p-3 text-[#444a53] hover:bg-[#f5f7fa]">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleImportClick} title="Import strategy" className="border-l border-[#dfe3e8] p-3 text-[#444a53] hover:bg-[#f5f7fa]">
              <FolderInput className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleExportXml} disabled={!workspaceStats.xml} title="Save XML" className="border-l border-[#dfe3e8] p-3 text-[#444a53] hover:bg-[#f5f7fa] disabled:opacity-40">
              <Download className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setActiveTab('charts')} title="Charts" className="border-l border-[#dfe3e8] p-3 text-[#444a53] hover:bg-[#f5f7fa]">
              <ChartCandlestick className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setActiveTab('tutorials')} title="Tutorials" className="border-l border-[#dfe3e8] p-3 text-[#444a53] hover:bg-[#f5f7fa]">
              <FileSpreadsheet className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleUndo} title="Undo" className="border-l border-[#dfe3e8] p-3 text-[#444a53] hover:bg-[#f5f7fa]">
              <RotateCcw className="h-4 w-4 scale-x-[-1]" />
            </button>
            <button type="button" onClick={handleRedo} title="Redo" className="border-l border-[#dfe3e8] p-3 text-[#444a53] hover:bg-[#f5f7fa]">
              <Redo2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleCenter} title="Center blocks" className="border-l border-[#dfe3e8] p-3 text-[#444a53] hover:bg-[#f5f7fa]">
              <Search className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleZoomIn} title="Zoom in" className="border-l border-[#dfe3e8] p-3 text-[#444a53] hover:bg-[#f5f7fa]">
              <Plus className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleZoomOut} title="Zoom out" className="border-l border-[#dfe3e8] p-3 text-[#444a53] hover:bg-[#f5f7fa]">
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="traders-dbot-workspace relative min-h-0 flex-1 overflow-hidden bg-[#fbfbfc]">
          <div ref={blocklyContainerRef} className="h-full w-full" />
        </div>
      </section>

      <aside className="flex min-h-0 flex-col bg-white">
        <div className="flex border-b border-[#e6e8ec] bg-white">
          {([
            ['summary', 'Summary'],
            ['transactions', 'Transactions'],
            ['journal', 'Journal'],
          ] as Array<[SummaryTab, string]>).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setSummaryTab(tabId)}
              className={`flex-1 border-b-[3px] px-4 py-4 text-[15px] font-semibold ${
                summaryTab === tabId ? 'border-[#1218ff] text-[#1d2128]' : 'border-transparent text-[#4c535f]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[#fafafa]">
          {summaryTab === 'summary' ? (
            <div className="flex min-h-full flex-col">
              <div className="m-4 flex-1 rounded-[16px] border border-[#eceef2] bg-white p-10 text-center">
                {activeContract || isRunning ? (
                  <div className="space-y-4 text-left text-[14px] text-[#2d323a]">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8b8f96]">Contract</div>
                        <div className="mt-2 font-semibold text-[#1e2329]">{activeContract?.symbol || selectedSymbolMeta?.name || selectedSymbol}</div>
                        <div className="mt-1">{activeContract?.status || (isRunning ? 'Running' : 'Idle')}</div>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8b8f96]">Account</div>
                        <div className="mt-2 font-semibold text-[#1e2329]">{authContext?.loginid || 'Visitor mode'}</div>
                        <div className="mt-1">{authContext?.accountId || 'No account runtime'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-t border-[#edf0f3] pt-4 text-center">
                      <div>
                        <div className="text-[12px] text-[#737984]">Total stake</div>
                        <div className="mt-2 text-[24px] font-semibold text-[#21262d]">{lastProposal?.ask_price ?? 0} {performanceCurrency}</div>
                      </div>
                      <div>
                        <div className="text-[12px] text-[#737984]">Total payout</div>
                        <div className="mt-2 text-[24px] font-semibold text-[#21262d]">{activeContract?.payout ?? 0} {performanceCurrency}</div>
                      </div>
                      <div>
                        <div className="text-[12px] text-[#737984]">No. of runs</div>
                        <div className="mt-2 text-[24px] font-semibold text-[#21262d]">{transactions.length}</div>
                      </div>
                      <div>
                        <div className="text-[12px] text-[#737984]">Contracts lost</div>
                        <div className="mt-2 text-[24px] font-semibold text-[#21262d]">{transactions.filter(item => Number(item.profit) < 0).length}</div>
                      </div>
                      <div>
                        <div className="text-[12px] text-[#737984]">Contracts won</div>
                        <div className="mt-2 text-[24px] font-semibold text-[#21262d]">{transactions.filter(item => Number(item.profit) > 0).length}</div>
                      </div>
                      <div>
                        <div className="text-[12px] text-[#737984]">Total profit/loss</div>
                        <div className="mt-2 text-[24px] font-semibold text-[#21262d]">{activeContract?.profit ?? 0} {performanceCurrency}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-[280px] flex-col items-center justify-center pt-20 text-center">
                    <p className="text-[18px] leading-9 text-[#343941]">
                      When you&rsquo;re ready to trade, hit <strong>Run</strong>.
                      You&rsquo;ll be able to track your bot&rsquo;s performance here.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-x-6 gap-y-5 border-t border-[#eceef2] px-10 py-8 text-center text-[14px] text-[#353a42]">
                <div>
                  <div className="font-semibold">{lastProposal?.ask_price ?? 0} {performanceCurrency}</div>
                  <div className="mt-1 text-[12px] text-[#7d838d]">Total stake</div>
                </div>
                <div>
                  <div className="font-semibold">{activeContract?.payout ?? 0} {performanceCurrency}</div>
                  <div className="mt-1 text-[12px] text-[#7d838d]">Total payout</div>
                </div>
                <div>
                  <div className="font-semibold">{transactions.length}</div>
                  <div className="mt-1 text-[12px] text-[#7d838d]">No. of runs</div>
                </div>
                <div>
                  <div className="font-semibold">{transactions.filter(item => Number(item.profit) < 0).length}</div>
                  <div className="mt-1 text-[12px] text-[#7d838d]">Contracts lost</div>
                </div>
                <div>
                  <div className="font-semibold">{transactions.filter(item => Number(item.profit) > 0).length}</div>
                  <div className="mt-1 text-[12px] text-[#7d838d]">Contracts won</div>
                </div>
                <div>
                  <div className="font-semibold">{activeContract?.profit ?? 0} {performanceCurrency}</div>
                  <div className="mt-1 text-[12px] text-[#7d838d]">Total profit/loss</div>
                </div>
              </div>
            </div>
          ) : null}

          {summaryTab === 'transactions' ? (
            <div className="p-4">
              {transactions.length ? (
                <div className="space-y-3">
                  {transactions.map(transaction => (
                    <div key={transaction.id} className="rounded-[12px] border border-[#eceef2] bg-white px-4 py-3 text-[13px] leading-6 text-[#434954]">
                      <div className="font-semibold text-[#1f2328]">{transaction.action}</div>
                      <div>{transaction.symbol || 'Symbol unavailable'} | {transaction.amount ?? 0} {transaction.currency || authContext?.currency || 'USD'}</div>
                      <div className="text-[#7b818d]">{new Date(transaction.timestamp * 1000).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[12px] border border-[#eceef2] bg-white p-8 text-center text-[15px] leading-8 text-[#545963]">
                  <div>There are no transactions to display.</div>
                  <div className="mt-3 text-[13px] text-[#777d87]">The bot is not running, or the stats were cleared.</div>
                </div>
              )}
            </div>
          ) : null}

          {summaryTab === 'journal' ? (
            <div className="p-4">
              {activityLog.length ? (
                <div className="space-y-3">
                  {activityLog.map(entry => (
                    <div key={entry} className="rounded-[12px] border border-[#eceef2] bg-white px-4 py-3 text-[13px] leading-6 text-[#434954]">
                      {entry}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[12px] border border-[#eceef2] bg-white p-8 text-center text-[15px] leading-8 text-[#545963]">
                  There are no messages to display.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );

  const renderCharts = () => (
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] bg-[#f7f8fa]">
      <aside className="border-r border-[#e7e8ec] bg-white px-5 py-5">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8d919b]">Active symbols</div>
        <div className="mt-4 space-y-2 overflow-y-auto">
          {featuredSymbols.map(symbol => (
            <button
              key={symbol.symbol}
              type="button"
              onClick={() => {
                setSelectedSymbol(symbol.symbol);
                appendActivity(`Switched chart to ${symbol.name}`);
              }}
              className={`w-full rounded-[14px] border px-4 py-3 text-left ${
                selectedSymbol === symbol.symbol
                  ? 'border-[#d5e7ff] bg-[#eef6ff]'
                  : 'border-[#ebecef] bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-[14px] font-semibold text-[#222]">{symbol.name}</div>
                <div className={`text-[11px] font-semibold ${symbol.exchangeOpen ? 'text-[#00a86b]' : 'text-[#c36a2d]'}`}>
                  {symbol.exchangeOpen ? 'OPEN' : 'CLOSED'}
                </div>
              </div>
              <div className="mt-1 text-[12px] text-[#70727a]">{symbol.symbol}</div>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col px-6 py-5">
        <div className="flex items-center justify-between rounded-[18px] border border-[#e7e8ec] bg-white px-5 py-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8d919b]">Live chart</div>
            <div className="mt-2 text-[28px] font-semibold text-[#171717]">{selectedSymbolMeta?.name || selectedSymbol}</div>
            <div className="mt-1 text-[14px] text-[#6d6f75]">{selectedSymbol}</div>
          </div>
          <div className="text-right">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8d919b]">Last quote</div>
            <div className="mt-2 text-[28px] font-semibold text-[#171717]">
              {formatQuote(latestTick?.quote, selectedSymbolMeta?.pipSize)}
            </div>
            <div className="mt-1 text-[14px] text-[#6d6f75]">{formatServerClock(serverTime)}</div>
          </div>
        </div>

        <div className="mt-5 flex-1 rounded-[22px] border border-[#e7e8ec] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-[#202020]">Tick stream</div>
            <div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${
              connectionState === 'open'
                ? 'bg-[#e8fff3] text-[#0b8f5a]'
                : connectionState === 'error'
                  ? 'bg-[#fff0f1] text-[#c23240]'
                  : 'bg-[#f2f3f5] text-[#7c818d]'
            }`}>
              {connectionState}
            </div>
          </div>

          <div className="rounded-[18px] bg-[#f7f8fb] p-4">
            <svg viewBox="0 0 620 160" className="h-[320px] w-full">
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#79b9ff" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#79b9ff" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="620" height="160" rx="18" fill="#f7f8fb" />
              {sparklinePath ? (
                <>
                  <path d={`${sparklinePath} L 620 160 L 0 160 Z`} fill="url(#chart-fill)" />
                  <path d={sparklinePath} fill="none" stroke="#1e88ff" strokeWidth="3" strokeLinecap="round" />
                </>
              ) : null}
            </svg>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-[16px] border border-[#ececf1] bg-[#fbfbfd] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8d919b]">Market</div>
              <div className="mt-2 text-[16px] text-[#202020]">{selectedSymbolMeta?.market || '--'}</div>
            </div>
            <div className="rounded-[16px] border border-[#ececf1] bg-[#fbfbfd] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8d919b]">Submarket</div>
              <div className="mt-2 text-[16px] text-[#202020]">{selectedSymbolMeta?.submarket || '--'}</div>
            </div>
            <div className="rounded-[16px] border border-[#ececf1] bg-[#fbfbfd] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8d919b]">Feed error</div>
              <div className="mt-2 text-[14px] text-[#202020]">{lastError || 'No feed errors.'}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderTutorials = () => (
    <div className="h-full overflow-auto bg-[#f7f8fa] px-6 py-6">
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-[22px] border border-[#e8e9ee] bg-white p-6">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8d919b]">Bot Builder</div>
          <h2 className="mt-3 text-[24px] font-semibold text-[#181818]">Build with blocks</h2>
          <p className="mt-3 text-[15px] leading-7 text-[#5d616a]">
            The builder now runs a real Blockly workspace in this repo. Toolbox categories match the Deriv DBot structure: Trade parameters, Purchase conditions, Sell conditions, Restart trading conditions, Analysis, and Utility.
          </p>
        </div>

        <div className="rounded-[22px] border border-[#e8e9ee] bg-white p-6">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8d919b]">Import</div>
          <h2 className="mt-3 text-[24px] font-semibold text-[#181818]">Load XML strategies</h2>
          <p className="mt-3 text-[15px] leading-7 text-[#5d616a]">
            XML import and export are wired to the local Blockly workspace, which is the foundation needed to reach DBot parity without relying on the remote iframe.
          </p>
        </div>

        <div className="rounded-[22px] border border-[#e8e9ee] bg-white p-6">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8d919b]">Execution</div>
          <h2 className="mt-3 text-[24px] font-semibold text-[#181818]">What remains</h2>
          <p className="mt-3 text-[15px] leading-7 text-[#5d616a]">
            Full parity still requires Deriv-specific trading blocks, strategy validation, proposal/buy execution, open-contract tracking, persistence, and Google Drive integration.
          </p>
        </div>
      </div>
    </div>
  );

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'bot_builder':
        return renderBotBuilder();
      case 'charts':
        return renderCharts();
      case 'tutorials':
        return renderTutorials();
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <style>{`
        .traders-dbot-workspace .blocklyToolboxDiv {
          display: none !important;
        }

        .traders-dbot-workspace .blocklyFlyout {
          border-right: 1px solid #e3e6eb;
        }

        .traders-dbot-workspace .blocklyFlyoutBackground {
          fill: #ffffff !important;
          fill-opacity: 1 !important;
        }

        .traders-dbot-workspace .blocklyMainBackground {
          stroke: transparent !important;
        }

        .traders-dbot-workspace .blocklyScrollbarHandle {
          fill: #c9ced6 !important;
        }

        .traders-dbot-workspace .blocklyTrash {
          opacity: 0.6;
        }
      `}</style>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex items-center border-b border-[#dfe3e8] bg-white px-5 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-12 shrink-0 items-center gap-3 rounded-[8px] px-5 text-[14px] font-semibold ${
                  isActive ? 'bg-[#f2f4f7] text-[#1a1d22]' : 'text-[#2f3642]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-4 flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={!workspaceStats.blockCount || !authContext?.accessToken || !authContext?.accountId || isRunning}
            className="inline-flex h-14 min-w-[112px] items-center justify-center gap-2 rounded-none bg-[#33a6c4] px-5 text-[17px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#bde6ea]"
            title={runStatusText}
          >
            <Bot className="h-5 w-5" />
            <span>{isRunning ? 'Running' : 'Run'}</span>
          </button>
          <div className="flex h-14 min-w-[340px] items-center justify-center border border-[#e4e6eb] bg-[#fafafa] px-5 text-[16px] font-semibold text-[#a8acb3]">
            <span>{runStatusText}</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {renderActiveContent()}
      </div>
    </div>
  );
}
