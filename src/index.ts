#!/usr/bin/env node
import { program } from './cli/program';
import updateNotifier from 'update-notifier';
const pkg = require('../package.json');

// Check for updates
updateNotifier({ pkg }).notify();

// Parse and run
program.parseAsync(process.argv);
