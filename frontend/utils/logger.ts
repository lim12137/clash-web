/**
 * Logger utility for development and production environments
 * In development: logs are printed to console
 * In production: logs are suppressed
 */

import { isProduction } from "@/const/constants";

// 在模块加载时就决定使用哪个实现
const log = isProduction
  ? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      log: () => {},
    }
  : {
      debug: (message: any, ...args: any[]) => {
        console.debug(`[DEBUG] ${message}`, ...args);
      },
      info: (message: any, ...args: any[]) => {
        console.info(`[INFO] ${message}`, ...args);
      },
      warn: (message: any, ...args: any[]) => {
        console.warn(`[WARN] ${message}`, ...args);
      },
      error: (message: any, ...args: any[]) => {
        console.error(`[ERROR] ${message}`, ...args);
      },
      log: (message: any, ...args: any[]) => {
        console.log(`[LOG] ${message}`, ...args);
      },
    };

export default log;
