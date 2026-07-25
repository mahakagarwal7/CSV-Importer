const app = require('../dist/src/app').default;

// Export compiled Express app directly as pure JavaScript Vercel Serverless Handler
// This avoids @vercel/node TypeScript AST compatibility crashes with TS 7.x during deployment
module.exports = app;
