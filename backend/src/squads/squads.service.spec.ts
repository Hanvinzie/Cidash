import { Test, TestingModule } from '@nestjs/testing';
import {
  SquadsService,
  FREE_SQUAD_MAX_MEMBERS,
  PREMIUM_SQUAD_MAX_MEMBERS,
} from './squads.service';
import { PrismaService } from '../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('SquadsService', () => {
  let service: SquadsService;

  const mockPrismaService = {
    squad: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    squadMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    coinTransaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SquadsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SquadsService>(SquadsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateUniqueInviteCode', () => {
    it('should generate an 8-character uppercase alphanumeric code', async () => {
      mockPrismaService.squad.findUnique.mockResolvedValueOnce(null);

      const code = await service.generateUniqueInviteCode();
      expect(code).toBeDefined();
      expect(code.length).toBe(8);
      expect(/^[A-Z0-9]{8}$/.test(code)).toBe(true);
    });
  });

  describe('createSquad', () => {
    it('should create a free squad with maxMembers = 5 and set creator as CAPTAIN', async () => {
      const userId = 'user-123';
      const dto = { name: 'Morning Runners', isPremium: false };
      const expectedSquad = {
        id: 'squad-1',
        name: 'Morning Runners',
        inviteCode: 'RUN78XYZ',
        isPremium: false,
        createdAt: new Date(),
        createdById: userId,
      };

      mockPrismaService.squad.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.squad.create.mockResolvedValueOnce(expectedSquad);
      mockPrismaService.squadMember.create.mockResolvedValueOnce({
        id: 'member-1',
        squadId: expectedSquad.id,
        userId,
        role: 'CAPTAIN',
      });

      const result = await service.createSquad(userId, dto);
      expect(result.message).toBe('Circle berhasil dibuat');
      expect(result.squad.name).toBe(dto.name);
      expect(result.squad.role).toBe('CAPTAIN');
      expect(result.squad.inviteCode).toHaveLength(8);
      expect(result.squad.maxMembers).toBe(FREE_SQUAD_MAX_MEMBERS);
    });
  });

  describe('joinSquad', () => {
    it('should join an existing squad successfully as MEMBER when below capacity', async () => {
      const userId = 'user-456';
      const dto = { inviteCode: 'RUN8MORN' };
      const existingSquad = {
        id: 'squad-1',
        name: 'GBK Sunset Runners',
        inviteCode: 'RUN8MORN',
        isPremium: false,
        _count: { members: 3 },
      };

      mockPrismaService.squad.findUnique.mockResolvedValueOnce(existingSquad);
      mockPrismaService.squadMember.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.squadMember.create.mockResolvedValueOnce({
        id: 'member-2',
        squadId: existingSquad.id,
        userId,
        role: 'MEMBER',
      });

      const result = await service.joinSquad(userId, dto);
      expect(result.message).toBe('Berhasil bergabung ke Circle');
      expect(result.squad.role).toBe('MEMBER');
      expect(result.squad.totalMembers).toBe(4);
      expect(result.squad.maxMembers).toBe(FREE_SQUAD_MAX_MEMBERS);
    });

    it('should reject joining a Free squad that already has 5 members', async () => {
      mockPrismaService.squad.findUnique.mockResolvedValueOnce({
        id: 'squad-free-full',
        name: 'Small Squad',
        inviteCode: 'FULLFREE',
        isPremium: false,
        _count: { members: FREE_SQUAD_MAX_MEMBERS },
      });
      mockPrismaService.squadMember.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.joinSquad('user-6', { inviteCode: 'FULLFREE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow joining a Premium squad with 5 members, up to 25 members max', async () => {
      mockPrismaService.squad.findUnique.mockResolvedValueOnce({
        id: 'squad-prem',
        name: 'Pro Runners Club',
        inviteCode: 'PROCLUB8',
        isPremium: true,
        _count: { members: 5 },
      });
      mockPrismaService.squadMember.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.squadMember.create.mockResolvedValueOnce({
        id: 'member-6',
        squadId: 'squad-prem',
        userId: 'user-6',
        role: 'MEMBER',
      });

      const res = await service.joinSquad('user-6', { inviteCode: 'PROCLUB8' });
      expect(res.squad.totalMembers).toBe(6);
      expect(res.squad.maxMembers).toBe(PREMIUM_SQUAD_MAX_MEMBERS);
    });

    it('should reject joining a Premium squad that already has 25 members', async () => {
      mockPrismaService.squad.findUnique.mockResolvedValueOnce({
        id: 'squad-prem-full',
        name: 'Maxed Club',
        inviteCode: 'MAXED25X',
        isPremium: true,
        _count: { members: PREMIUM_SQUAD_MAX_MEMBERS },
      });
      mockPrismaService.squadMember.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.joinSquad('user-26', { inviteCode: 'MAXED25X' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
