import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout with pretty output in dev
    },
  }),
  base: {
    service: 'aqualink-backend',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['*.password', '*.token', 'req.headers.authorization'],
    censor: '[REDACTED]',
  },
});

export default logger;
