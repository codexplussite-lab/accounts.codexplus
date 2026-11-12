import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Accounting ERP Backend listening on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`🔗 Health Check: http://localhost:${env.PORT}/health`);
  logger.info(`🔗 API Base: http://localhost:${env.PORT}/api`);
});

// Graceful process shutdown handlers
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    logger.info("Server closed successfully.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully...");
  server.close(() => {
    logger.info("Server closed successfully.");
    process.exit(0);
  });
});
