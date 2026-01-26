#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// The directory where the package is actually located
const projectDir = path.join(__dirname, '..');

console.log(`Starting Console-Chat from ${projectDir}...`);

const child = spawn('npm', ['start'], {
  cwd: projectDir,
  shell: true,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code);
});
