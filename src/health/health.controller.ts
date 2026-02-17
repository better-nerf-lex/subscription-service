import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  healthCheck() {
    return {
      status: 'healthy',
      service: 'subscription-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  readinessCheck() {
    return {
      status: 'ready',
      service: 'subscription-service',
      timestamp: new Date().toISOString(),
    };
  }
}
