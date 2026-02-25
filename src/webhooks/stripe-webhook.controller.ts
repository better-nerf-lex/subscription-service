import {
    Controller,
    Post,
    Req,
    Headers,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('webhooks')
export class StripeWebhookController {
    private readonly logger = new Logger(StripeWebhookController.name);

    constructor(private readonly stripeWebhookService: StripeWebhookService) { }

    @Post('stripe')
    @HttpCode(HttpStatus.OK)
    async handleStripeWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('stripe-signature') signature: string,
    ): Promise<{ received: boolean }> {
        const rawBody = req.rawBody;

        if (!rawBody) {
            this.logger.error('Raw body not available — ensure rawBody: true in NestFactory.create');
            throw new Error('Raw body unavailable');
        }

        if (!signature) {
            this.logger.error('Missing stripe-signature header');
            throw new Error('Missing Stripe signature');
        }

        const event = this.stripeWebhookService.constructEvent(rawBody, signature);
        await this.stripeWebhookService.handleEvent(event);

        return { received: true };
    }
}
