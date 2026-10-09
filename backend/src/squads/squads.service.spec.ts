import { Test, TestingModule } from '@nestjs/testing';
import { SquadsService } from './squads.service';
import { PrismaService } from '../database/prisma.service';

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
    it('should create a squad with unique invite code and set creator as CAPTAIN', async () => {
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
    });
  });

  describe('joinSquad', () => {
    it('should join an existing squad successfully as MEMBER', async () => {
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
    });
  });
});
