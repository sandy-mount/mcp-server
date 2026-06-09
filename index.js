import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';

function createResponse(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function createErrorResponse(id, code, message) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  };
}

async function loadPlugins(pluginDirs, logger) {
  const plugins = new Map();

  for (const pluginsDir of pluginDirs) {
    try {
      const files = await fs.readdir(pluginsDir);
      for (const file of files) {
        if (!file.endsWith('.js')) {
          continue;
        }

        const moduleUrl = new URL(file, pluginsDir);
        const plugin = await import(moduleUrl.href);
        if (typeof plugin.tool !== 'function') {
          logger.warn(`Skipping plugin file ${file} (missing 'tool' function)`);
          continue;
        }

        const toolConfig = plugin.tool();
        plugins.set(toolConfig.name, {
          handler: toolConfig.fn,
          capability: {
            description: toolConfig.description,
            params: {
              type: "object",
              properties: Object.fromEntries(
                toolConfig.inputs?.map((input) => [
                  input.name,
                  {
                    type: input.type,
                    description: input.description
                  }
                ]) || []
              )
            }
          }
        });
        logger.log(`Loaded plugin: ${toolConfig.name}`);
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        logger.log(`Optional plugin directory not found: ${pluginsDir}`);
        continue;
      }
      throw err;
    }
  }

  return plugins;
}

export async function createMcpApp(options = {}) {
  const logger = options.logger ?? console;
  const pluginDirs = options.pluginDirs ?? [
    new URL('./plugins/', import.meta.url),
    new URL('./private-plugins/', import.meta.url)
  ];
  const plugins = await loadPlugins(pluginDirs, logger);
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.post('/', async (req, res) => {
    try {
      const message = req.body;
      logger.log("Received message:", message);

      if (!message.jsonrpc || message.jsonrpc !== "2.0") {
        return res.json(createErrorResponse(message.id, -32600, "Invalid JSON-RPC request"));
      }
      if (!message.method) {
        return res.json(createErrorResponse(message.id, -32600, "Method is required"));
      }

      if (message.method === "initialize") {
        const capabilities = {};
        plugins.forEach((plugin, method) => {
          if (plugin.capability) {
            capabilities[method] = plugin.capability;
          }
        });
        const response = {
          capabilities,
          serverInfo: {
            name: "Pluggable MCP Server",
            version: "1.0.0"
          }
        };
        return res.json(createResponse(message.id, response));
      }

      const plugin = plugins.get(message.method);
      if (!plugin) {
        return res.json(createErrorResponse(message.id, -32601, "Method not found"));
      }

      const result = await plugin.handler(message.params);
      return res.json(createResponse(message.id, result));
    } catch (err) {
      logger.error("Error processing request:", err);
      return res.status(500).json(createErrorResponse(null, -32603, "Internal server error"));
    }
  });

  return app;
}

export { createErrorResponse, createResponse };
