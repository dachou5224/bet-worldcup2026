module.exports = {
  apps: [
    {
      name: "guess-worldcup2026",
      cwd: "/var/www/guess_worldcup2026",
      script: "server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        MARKET_DATA_MODE: "real",
        LIVE_DATA_MODE: "real",
        POLYMARKET_PUBLIC_ENABLED: "false",
      },
    },
  ],
};
