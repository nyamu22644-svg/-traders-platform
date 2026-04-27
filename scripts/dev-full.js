import { spawn } from 'node:child_process';
import path from 'node:path';

const rootDir = process.cwd();
const nodeExec = process.execPath;

function startProcess(label, args, color) {
  const child = spawn(nodeExec, args, {
    cwd: rootDir,
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.on('data', chunk => {
    process.stdout.write(`\x1b[${color}m[${label}]\x1b[0m ${chunk}`);
  });

  child.stderr.on('data', chunk => {
    process.stderr.write(`\x1b[${color}m[${label}]\x1b[0m ${chunk}`);
  });

  return child;
}

const apiProcess = startProcess('api', ['scripts/local-dev-server.js'], '36');
const webProcess = startProcess('web', ['node_modules/vite/bin/vite.js', '--port=3000', '--host=0.0.0.0'], '35');

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  apiProcess.kill();
  webProcess.kill();
  process.exit(code);
}

apiProcess.on('exit', code => {
  if (!shuttingDown && code && code !== 0) shutdown(code);
});

webProcess.on('exit', code => {
  if (!shuttingDown && code && code !== 0) shutdown(code);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
