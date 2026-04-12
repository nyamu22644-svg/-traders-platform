import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Settings, Key, Percent, Plus } from 'lucide-react';

export function TradingSettings() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-50">Trading Configuration</h3>
          <p className="text-sm text-zinc-400">Manage trading pairs, leverage, and exchange connections.</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Global Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Site Trading Settings Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-zinc-400" />
              Platform Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200">Default Max Leverage</label>
              <Input type="number" placeholder="e.g., 10" disabled />
              <p className="text-xs text-zinc-500">Maximum leverage allowed for users on this site.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200">Allowed Trading Pairs</label>
              <Input type="text" placeholder="e.g., BTC/USD, ETH/USD" disabled />
              <p className="text-xs text-zinc-500">Comma-separated list of allowed pairs.</p>
            </div>
            <Button disabled className="w-full">Save Limits (Coming Soon)</Button>
          </CardContent>
        </Card>

        {/* Commission Rules Placeholder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="w-4 h-4 text-zinc-400" />
              Commission Rules
            </CardTitle>
            <Button variant="outline" size="sm" disabled className="h-8">
              <Plus className="w-4 h-4 mr-1" /> Add Tier
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/30">
              <p className="text-sm text-zinc-400">No commission tiers configured.</p>
              <p className="text-xs text-zinc-500 mt-1">Set up maker/taker fees for your users.</p>
            </div>
          </CardContent>
        </Card>

        {/* API Credentials Metadata Placeholder */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4 text-zinc-400" />
              Connected Exchanges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/30">
              <p className="text-sm text-zinc-400">No exchange API keys connected.</p>
              <p className="text-xs text-zinc-500 mt-1">Users will connect their exchange accounts here.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
