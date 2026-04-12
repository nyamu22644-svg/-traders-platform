import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Settings</h1>
        <p className="text-zinc-400 mt-1">Manage your account preferences.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your personal account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-200">
              Email Address
            </label>
            <Input
              type="email"
              disabled
              value={user?.email || ''}
              className="bg-zinc-900/50 text-zinc-400"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-200">
              User ID
            </label>
            <Input
              type="text"
              disabled
              value={user?.id || ''}
              className="bg-zinc-900/50 text-zinc-400 font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

