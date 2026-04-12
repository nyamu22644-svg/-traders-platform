import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Bot, Plus, Settings } from 'lucide-react';

export function BotSettings() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-50">Bot Configuration</h3>
          <p className="text-sm text-zinc-400">Manage bot limits, templates, and strategies.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bot Limits Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-zinc-400" />
              Bot Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200">Max Bots Per User</label>
              <Input type="number" placeholder="e.g., 5" disabled />
              <p className="text-xs text-zinc-500">Maximum number of active bots allowed per user.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200">Max Concurrent Trades</label>
              <Input type="number" placeholder="e.g., 10" disabled />
              <p className="text-xs text-zinc-500">Maximum concurrent trades per bot.</p>
            </div>
            <Button disabled className="w-full">Save Limits (Coming Soon)</Button>
          </CardContent>
        </Card>

        {/* Bot Templates Placeholder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-zinc-400" />
              Bot Templates
            </CardTitle>
            <Button variant="outline" size="sm" disabled className="h-8">
              <Plus className="w-4 h-4 mr-1" /> New Template
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/30">
              <p className="text-sm text-zinc-400">No bot templates available.</p>
              <p className="text-xs text-zinc-500 mt-1">Create predefined strategies for your users.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
