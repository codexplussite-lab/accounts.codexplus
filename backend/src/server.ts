import { app } from "./app.js";
import { env } from "./config/env.js";
import pino from "pino";

const logger = pino({
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true }
        }
      : undefined
});

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Accounting ERP Backend running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  logger.info(`🔗 Health check available at: http://localhost:${env.PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    logger.info("Process terminated.");
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully...");
  server.close(() => {
    logger.info("Process terminated.");
  });
});

