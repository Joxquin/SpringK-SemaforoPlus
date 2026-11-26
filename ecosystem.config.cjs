module.exports = {
  apps: [
    {
      name: 'iot-gateway',
      cwd: '/home/joxquin/SpringK-SemaforoPlus/iot-gateway-service',
      script: 'java',
      args: '-jar target/iot-gateway-service-2.0.0.jar',
      env: {
        PORT: 8081,
        SPRING_PROFILES_ACTIVE: 'default'
      },
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: 'traffic-core',
      cwd: '/home/joxquin/SpringK-SemaforoPlus/traffic-core-service',
      script: 'java',
      args: '-jar target/traffic-core-service-2.0.0.jar',
      env: {
        PORT: 8082,
        SPRING_PROFILES_ACTIVE: 'default'
      },
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: 'ml-vision',
      cwd: '/home/joxquin/SpringK-SemaforoPlus/ml-vision-service',
      script: '/home/joxquin/SpringK-SemaforoPlus/ml-vision-service/detector.py',
      interpreter: '/home/joxquin/semaforoPlus/ml_service/venv/bin/python3',
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
};
