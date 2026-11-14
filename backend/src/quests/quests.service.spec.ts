import { Test, TestingModule } from '@nestjs/testing';
import {
  QuestsService,
  BOMB_MISSION_FEE,
  SNOOZE_MISSION_FEE,
} from './quests.service';
import { PrismaService } from '../database/prisma.service';
import { ActivityType, QuestStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('QuestsService', () => {
  let service: QuestsService;

  const mockPrismaService = {
    quest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    squadMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    coinTransaction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    pointLedger: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QuestsService>(QuestsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createQuest', () => {
    it('should create a bomb mission, deduct creator coins, and record transaction', async () => {
      const creatorId = 'creator-1';
      const targetUserId = 'target-2';
      const squadId = 'squad-1';

      const dto = {
        squadId,
        targetUserId,
        activityType: ActivityType.RUNNING,
        targetDistance: 5000,
        targetMaxPace: 6.0,
        stakesPoints: 50,
        rewardTitle: 'Weekend Run Challenge',
        deadline: new Date(Date.now() + 86400000).toISOString(),
      };

      mockPrismaService.squadMember.findUnique
        .mockResolvedValueOnce({ squadId, userId: creatorId })
        .mockResolvedValueOnce({ squadId, userId: targetUserId });

      mockPrismaService.coinTransaction.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaService.quest.findMany.mockResolvedValueOnce([]);

      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: creatorId,
        coinBalance: 100,
        name: 'Creator User',
      });

      mockPrismaService.user.update.mockResolvedValueOnce({
        coinBalance: 100 - BOMB_MISSION_FEE,
      });

      const mockQuest = {
        id: 'quest-123',
        squadId,
        creatorId,
        targetUserId,
        stakesPoints: 50,
        status: QuestStatus.PENDING,
      };
      mockPrismaService.quest.create.mockResolvedValueOnce(mockQuest);
      mockPrismaService.coinTransaction.create.mockResolvedValueOnce({ id: 'tx-1' });

      const result = await service.createQuest(creatorId, dto);

      expect(result.message).toBe('Bomb Mission berhasil dikirimkan ke teman satu Circle');
      expect(result.cost).toBe(BOMB_MISSION_FEE);
      expect(result.remainingCoinBalance).toBe(80);
      expect(result.quest.id).toBe('quest-123');
    });

    it('should block sending a bomb mission if target user already has an active mission (IN_MISSION)', async () => {
      const creatorId = 'creator-1';
      const targetUserId = 'target-2';
      const squadId = 'squad-1';

      mockPrismaService.squadMember.findUnique
        .mockResolvedValueOnce({ squadId, userId: creatorId })
        .mockResolvedValueOnce({ squadId, userId: targetUserId });

      mockPrismaService.coinTransaction.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaService.quest.findMany.mockResolvedValueOnce([{ id: 'active-q1' }]);

      await expect(
        service.createQuest(creatorId, {
          squadId,
          targetUserId,
          activityType: ActivityType.RUNNING,
          targetDistance: 3000,
          stakesPoints: 40,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block sending a bomb mission if target user is in RESTING mode', async () => {
      const creatorId = 'creator-1';
      const targetUserId = 'target-2';
      const squadId = 'squad-1';
      const futureIso = new Date(Date.now() + 12 * 3600 * 1000).toISOString();

      mockPrismaService.squadMember.findUnique
        .mockResolvedValueOnce({ squadId, userId: creatorId })
        .mockResolvedValueOnce({ squadId, userId: targetUserId });

      mockPrismaService.coinTransaction.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ reference: `REST-ACTIVE:${futureIso}` }]);
      mockPrismaService.quest.findMany.mockResolvedValueOnce([]);

      await expect(
        service.createQuest(creatorId, {
          squadId,
          targetUserId,
          activityType: ActivityType.RUNNING,
          targetDistance: 3000,
          stakesPoints: 40,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('useShieldTicket', () => {
    it('should shield active quest, deduct one shield ticket, and refund 50% coins to sender if PENDING', async () => {
      const questId = 'quest-123';
      const targetUserId = 'target-2';

      const mockQuest = {
        id: questId,
        creatorId: 'creator-1',
        targetUserId,
        stakesPoints: 40,
        status: QuestStatus.PENDING,
        deadline: new Date(Date.now() + 86400000),
      };

      mockPrismaService.quest.findUnique.mockResolvedValueOnce(mockQuest);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: targetUserId,
        shieldTickets: 2,
      });

      mockPrismaService.user.update
        .mockResolvedValueOnce({ shieldTickets: 1 })
        .mockResolvedValueOnce({ coinBalance: 90 });
      mockPrismaService.quest.update.mockResolvedValueOnce({
        id: questId,
        status: QuestStatus.SHIELDED,
      });
      mockPrismaService.coinTransaction.create.mockResolvedValueOnce({ id: 'refund-1' });

      const result = await service.useShieldTicket(questId, targetUserId);

      expect(result.message).toContain('Shield Ticket berhasil digunakan');
      expect(result.status).toBe(QuestStatus.SHIELDED);
      expect(result.senderRefundCoins).toBe(10);
    });
  });

  describe('snoozeQuest', () => {
    it('should extend quest deadline by 12 hours for 10 coins', async () => {
      const questId = 'quest-12345678';
      const targetUserId = 'target-2';
      const initialDeadline = new Date(Date.now() + 6 * 3600 * 1000);

      mockPrismaService.quest.findUnique.mockResolvedValueOnce({
        id: questId,
        targetUserId,
        status: QuestStatus.PENDING,
        deadline: initialDeadline,
      });
      mockPrismaService.coinTransaction.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: targetUserId,
        coinBalance: 50,
      });
      mockPrismaService.user.update.mockResolvedValueOnce({
        coinBalance: 50 - SNOOZE_MISSION_FEE,
      });
      mockPrismaService.quest.update.mockResolvedValueOnce({
        id: questId,
        deadline: new Date(initialDeadline.getTime() + 12 * 3600 * 1000),
      });
      mockPrismaService.coinTransaction.create.mockResolvedValueOnce({ id: 'tx-snooze' });

      const res = await service.snoozeQuest(questId, targetUserId);
      expect(res.cost).toBe(SNOOZE_MISSION_FEE);
      expect(res.remainingCoinBalance).toBe(40);
      expect(res.snoozed).toBe(true);
    });
  });
});
