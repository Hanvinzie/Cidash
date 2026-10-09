import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesService } from './activities.service';
import { AntiCheatService } from './services/anti-cheat.service';
import { PrismaService } from '../database/prisma.service';
import { ActivityType, QuestStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let antiCheatService: AntiCheatService;

  const mockPrismaService = {
    quest: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    activity: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    pointLedger: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        AntiCheatService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
    antiCheatService = module.get<AntiCheatService>(AntiCheatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(antiCheatService).toBeDefined();
  });

  describe('AntiCheatService validation', () => {
    it('should reject impossible human running speed', () => {
      expect(() => {
        antiCheatService.validateActivity(
          ActivityType.RUNNING,
          5000,
          300, // 5000m dalam 5 menit = 16.6 m/s (60 km/h)
          1.0,
          [],
        );
      }).toThrow(BadRequestException);
    });

    it('should pass normal running activity', () => {
      const result = antiCheatService.validateActivity(
        ActivityType.RUNNING,
        5000,
        1800, // 5km dalam 30 menit = 2.77 m/s (pace 6:00 min/km)
        6.0,
        [],
      );
      expect(result.isValid).toBe(true);
    });
  });

  describe('createActivity', () => {
    it('should record activity and complete matching active quest', async () => {
      const userId = 'user-1';
      const dto = {
        type: ActivityType.RUNNING,
        distanceMeters: 5200,
        durationSeconds: 1800,
        averagePace: 5.76,
        routeGeoJson: { type: 'LineString', coordinates: [[106.8, -6.2], [106.81, -6.21]] },
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        endedAt: new Date().toISOString(),
      };

      const mockQuest = {
        id: 'quest-99',
        targetUserId: userId,
        targetDistance: 5000,
        targetMaxPace: 6.0,
        stakesPoints: 50,
        status: QuestStatus.PENDING,
      };

      mockPrismaService.quest.findMany.mockResolvedValueOnce([mockQuest]);
      mockPrismaService.activity.create.mockResolvedValueOnce({
        id: 'act-1',
        userId,
        ...dto,
      });
      mockPrismaService.quest.update.mockResolvedValueOnce({
        id: mockQuest.id,
        status: QuestStatus.COMPLETED,
      });
      mockPrismaService.pointLedger.create.mockResolvedValue({});
      mockPrismaService.user.update.mockResolvedValueOnce({
        id: userId,
        rankPoints: 200,
      });

      const result = await service.createActivity(userId, dto);

      expect(result.message).toContain('Misi Tantangan telah diselesaikan');
      expect(result.questCompleted).toBeDefined();
      expect(result.questCompleted?.id).toBe(mockQuest.id);
      expect(result.rewards.questBonusPoints).toBe(50);
    });
  });
});
