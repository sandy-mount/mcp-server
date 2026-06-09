#!/usr/bin/env node

import { createMcpApp } from '../index.js';

const DEFAULT_PORT = 4333;

const PORT = process.env.PORT || DEFAULT_PORT;
const app = await createMcpApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
