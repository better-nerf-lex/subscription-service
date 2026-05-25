import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SubscriptionsService } from './services/subscription';
import { CreateSubscriptionDto } from './dto/create-subscription';
import { RenewSubscriptionDto } from './dto/renew-subscription';
import { QuerySubscriptionsDto } from './dto/query-subscriptions';
import { SubscriptionResponseDto } from './dto/subscription-response';
import { EntityType } from '../common/enums/entity-type';
import { BillingCheckoutService } from './services/billing-checkout';
import { TokenLedgerService } from './services/token-ledger';
import {
  CheckoutSessionResponseDto,
  CreateSubscriptionCheckoutDto,
  CreateTopUpCheckoutDto,
} from './dto/checkout-session';
import { ReservationKeyDto, ReserveTokensDto, TokenStatusDto } from './dto/token';

@Controller('api/v1/subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly billingCheckoutService: BillingCheckoutService,
    private readonly tokenLedgerService: TokenLedgerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(
    @Body(ValidationPipe) createDto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionsService.createSubscription(createDto);
    return SubscriptionResponseDto.fromEntity(subscription);
  }

  @Get()
  async listSubscriptions(
    @Query(new ValidationPipe({ transform: true })) query: QuerySubscriptionsDto,
  ): Promise<{
    subscriptions: SubscriptionResponseDto[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const subscriptions = await this.subscriptionsService.listSubscriptions(query);
    return {
      subscriptions: SubscriptionResponseDto.fromEntities(subscriptions),
      total: subscriptions.length,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    };
  }

  @Post('checkout/subscription')
  @HttpCode(HttpStatus.OK)
  async createSubscriptionCheckout(
    @Body(ValidationPipe) request: CreateSubscriptionCheckoutDto,
  ): Promise<CheckoutSessionResponseDto> {
    return this.billingCheckoutService.createSubscriptionCheckout(
      request.entityId,
      request.entityType,
      request.plan,
    );
  }

  @Post('checkout/top-up')
  @HttpCode(HttpStatus.OK)
  async createTopUpCheckout(
    @Body(ValidationPipe) request: CreateTopUpCheckoutDto,
  ): Promise<CheckoutSessionResponseDto> {
    return this.billingCheckoutService.createTopUpCheckout(
      request.entityId,
      request.entityType,
      request.pack,
    );
  }

  @Post('tokens/reserve')
  @HttpCode(HttpStatus.OK)
  async reserveTokens(
    @Body(ValidationPipe) request: ReserveTokensDto,
  ): Promise<{ reservationKey: string; status: string }> {
    const reservation = await this.tokenLedgerService.reserveTokens(
      request.entityId,
      request.entityType,
      request.reservationKey,
      request.amount,
      request.documentId,
    );
    return { reservationKey: reservation.reservationKey, status: reservation.status };
  }

  @Post('tokens/commit')
  @HttpCode(HttpStatus.OK)
  async commitReservation(
    @Body(ValidationPipe) request: ReservationKeyDto,
  ): Promise<{ reservationKey: string; status: string }> {
    const reservation = await this.tokenLedgerService.commitReservation(request.reservationKey);
    return { reservationKey: reservation.reservationKey, status: reservation.status };
  }

  @Post('tokens/refund')
  @HttpCode(HttpStatus.OK)
  async refundReservation(
    @Body(ValidationPipe) request: ReservationKeyDto,
  ): Promise<{ reservationKey: string; status: string }> {
    const reservation = await this.tokenLedgerService.refundReservation(request.reservationKey);
    return { reservationKey: reservation.reservationKey, status: reservation.status };
  }

  @Get(':id')
  async getSubscription(@Param('id', ParseUUIDPipe) id: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionsService.findById(id);
    return SubscriptionResponseDto.fromEntity(subscription);
  }

  @Get('entity/:entityType/:entityId')
  async getEntitySubscriptions(
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string,
  ): Promise<SubscriptionResponseDto[]> {
    const subscriptions = await this.subscriptionsService.findByEntity(entityId, entityType);
    return SubscriptionResponseDto.fromEntities(subscriptions);
  }

  @Get('entity/:entityType/:entityId/active')
  async getActiveEntitySubscription(
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionsService.getActiveEntitySubscription(
      entityId,
      entityType,
    );
    return SubscriptionResponseDto.fromEntity(subscription);
  }

  @Get('entity/:entityType/:entityId/status')
  async checkEntitySubscriptionStatus(
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string,
  ): Promise<{ entityId: string; entityType: EntityType; isActive: boolean }> {
    const isActive = await this.subscriptionsService.isEntitySubscriptionActive(
      entityId,
      entityType,
    );
    return {
      entityId,
      entityType,
      isActive,
    };
  }

  @Get('entity/:entityType/:entityId/billing')
  async getBillingStatus(
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string,
  ): Promise<TokenStatusDto> {
    return this.tokenLedgerService.getStatus(entityId, entityType);
  }

  @Put(':id/renew')
  async renewSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) renewDto: RenewSubscriptionDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.subscriptionsService.renewSubscription(id, new Date(renewDto.validUntil));
    return {
      success: true,
      message: 'Subscription renewed successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.subscriptionsService.cancelSubscription(id);
    return {
      success: true,
      message: 'Subscription cancelled successfully',
    };
  }
}
