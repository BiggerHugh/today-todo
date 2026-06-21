module.exports = {
  apps: [
    {
      name: 'today-todo-api',
      script: 'index.js',
      cwd: '/var/www/today-todo-server',
      env: {
        NODE_ENV: 'production',
        PORT: 3456,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/www/today-todo-server/logs/error.log',
      out_file: '/var/www/today-todo-server/logs/out.log',
    },
  ],
};
