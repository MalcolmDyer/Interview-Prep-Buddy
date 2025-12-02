const { spawn } = require('child_process');
const electronPath = require('electron');

const args = process.argv.slice(2);
const env = { ...process.env };
// Ensure Electron runs in app mode, not Node mode
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, args, {
  stdio: 'inherit',
  env
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Electron exited with signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
