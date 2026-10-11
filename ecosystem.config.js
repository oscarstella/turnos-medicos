module.exports = {
  apps: [
    {
      name: 'turnos-backend',
      script: 'server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 5060
      }
    }
  ]
};
