import { Test, TestingModule } from '@nestjs/testing';
import {
  QuestsService,
  BOMB_MISSION_FEE,
  SNOOZE_MISSION_FEE,
} from './quests.service';
import { PrismaService } from '../database/prisma.service';
import { ActivityType, QuestDifficulty, QuestStatus } from '@prisma/client';
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
        difficulty: QuestDifficulty.MEDIUM,
        rewardTitle: 'Weekend Run Challenge',
        deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
      };
      // 5 km x 2.5 koin/km x 1.4 (Medium) x 1.2 (3 hari) = 21 koin → taruhan MEDIUM (70 RP), batas 43 menit
      const EXPECTED_COINS = 21;

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
        coinBalance: 100 - EXPECTED_COINS,
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
      expect(result.cost).toBe(EXPECTED_COINS);
      expect(result.pricing).toMatchObject({ coins: 21, stakesTier: 'MEDIUM', stakesPoints: 70, timeLimitMin: 43 });
      expect(mockPrismaService.quest.create.mock.calls[0][0].data).toMatchObject({
        wagerCoins: 21,
        stakesPoints: 70,
        difficulty: QuestDifficulty.MEDIUM,
        targetMaxPace: 8.5,
      });
      expect(result.remainingCoinBalance).toBe(79);
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
          difficulty: QuestDifficulty.EASY,
          deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
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
          difficulty: QuestDifficulty.EASY,
          deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createQuest rules', () => {
    const base = {
      squadId: 'squad-1',
      targetUserId: 'target-2',
      activityType: ActivityType.RUNNING,
      targetDistance: 5000,
      difficulty: QuestDifficulty.HARD,
      deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
    };

    it('rejects a distance that is not one of the official options', async () => {
      await expect(service.createQuest('creator-1', { ...base, targetDistance: 4200 })).rejects.toThrow(/Jarak misi/);
    });

    it('rejects a deadline shorter than 1 day', async () => {
      const soon = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
      await expect(service.createQuest('creator-1', { ...base, deadline: soon })).rejects.toThrow(/antara 1 sampai 7 hari/);
    });

    it('rejects a deadline longer than 7 days', async () => {
      const far = new Date(Date.now() + 10 * 86400000).toISOString();
      await expect(service.createQuest('creator-1', { ...base, deadline: far })).rejects.toThrow(/antara 1 sampai 7 hari/);
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
