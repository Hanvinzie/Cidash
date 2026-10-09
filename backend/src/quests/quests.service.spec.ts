import { Test, TestingModule } from '@nestjs/testing';
import { QuestsService, BOMB_MISSION_FEE } from './quests.service';
import { PrismaService } from '../database/prisma.service';
import { ActivityType, QuestStatus } from '@prisma/client';

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
  });

  describe('useShieldTicket', () => {
    it('should shield active quest and deduct one shield ticket', async () => {
      const questId = 'quest-123';
      const targetUserId = 'target-2';

      const mockQuest = {
        id: questId,
        targetUserId,
        status: QuestStatus.PENDING,
        deadline: new Date(Date.now() + 86400000),
      };

      mockPrismaService.quest.findUnique.mockResolvedValueOnce(mockQuest);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: targetUserId,
        shieldTickets: 2,
      });

      mockPrismaService.user.update.mockResolvedValueOnce({
        shieldTickets: 1,
      });
      mockPrismaService.quest.update.mockResolvedValueOnce({
        id: questId,
        status: QuestStatus.SHIELDED,
      });

      const result = await service.useShieldTicket(questId, targetUserId);

      expect(result.message).toContain('Shield Ticket berhasil digunakan');
      expect(result.status).toBe(QuestStatus.SHIELDED);
    });
  });
});
