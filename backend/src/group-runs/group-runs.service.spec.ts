import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GroupRunStatus } from '@prisma/client';
import { GroupRunsService } from './group-runs.service';
import { PrismaService } from '../database/prisma.service';

const SQUAD = '11111111-1111-4111-8111-111111111111';
const RUN = '22222222-2222-4222-8222-222222222222';

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN,
    squadId: SQUAD,
    hostId: 'host',
    status: GroupRunStatus.WAITING,
    createdAt: new Date('2026-11-22T10:00:00Z'),
    startedAt: null,
    endedAt: null,
    host: { id: 'host', name: 'Host' },
    participants: [
      { userId: 'host', joinedAt: new Date('2026-11-22T10:00:00Z'), user: { id: 'host', name: 'Host' } },
      { userId: 'u2', joinedAt: new Date('2026-11-22T10:01:00Z'), user: { id: 'u2', name: 'Two' } },
    ],
    ...overrides,
  };
}

describe('GroupRunsService', () => {
  let service: GroupRunsService;

  const prisma = {
    squadMember: { findUnique: jest.fn() },
    groupRun: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    groupRunParticipant: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const asMember = () => prisma.squadMember.findUnique.mockResolvedValue({ id: 'm' });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupRunsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GroupRunsService);
    prisma.groupRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.groupRun.deleteMany.mockResolvedValue({ count: 1 });
    prisma.groupRunParticipant.deleteMany.mockResolvedValue({ count: 1 });
  });

  describe('membership', () => {
    it('refuses to list rooms for a circle the user is not in', async () => {
      prisma.squadMember.findUnique.mockResolvedValue(null);
      await expect(service.list('stranger', SQUAD)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.groupRun.findMany).not.toHaveBeenCalled();
    });

    it('refuses to show a room of another circle', async () => {
      prisma.groupRun.findUnique.mockResolvedValue(run());
      prisma.squadMember.findUnique.mockResolvedValue(null);
      await expect(service.get('stranger', RUN)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns 404 for an unknown room', async () => {
      prisma.groupRun.findUnique.mockResolvedValue(null);
      await expect(service.get('u', RUN)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('expires stale rooms first and returns only open rooms with names', async () => {
      asMember();
      prisma.groupRun.findMany.mockResolvedValue([run()]);
      const res = await service.list('host', SQUAD);
      expect(prisma.groupRun.updateMany).toHaveBeenCalledTimes(1);
      const where = prisma.groupRun.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: [GroupRunStatus.WAITING, GroupRunStatus.ACTIVE] });
      expect(res.rooms[0]).toMatchObject({ id: RUN, circleId: SQUAD, hostName: 'Host', status: 'WAITING' });
      expect(res.rooms[0].participants.map((p) => p.username)).toEqual(['Host', 'Two']);
    });
  });

  describe('create', () => {
    it('creates a room with the host as first participant', async () => {
      asMember();
      prisma.groupRun.findFirst.mockResolvedValue(null);
      prisma.groupRunParticipant.findFirst.mockResolvedValue(null);
      prisma.groupRun.create.mockResolvedValue({ id: RUN });
      prisma.groupRun.findMany.mockResolvedValue([{ id: RUN }]);
      prisma.groupRun.findUnique.mockResolvedValue(run());
      const res = await service.create('host', SQUAD);
      expect(prisma.groupRun.create.mock.calls[0][0].data).toMatchObject({
        squadId: SQUAD,
        hostId: 'host',
        participants: { create: { userId: 'host' } },
      });
      expect(res.room.id).toBe(RUN);
    });

    it('rejects when the circle already has an open room', async () => {
      asMember();
      prisma.groupRun.findFirst.mockResolvedValue({ id: 'other' });
      await expect(service.create('host', SQUAD)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.groupRun.create).not.toHaveBeenCalled();
    });

    it('rejects when the user is already in another open room', async () => {
      asMember();
      prisma.groupRun.findFirst.mockResolvedValue(null);
      prisma.groupRunParticipant.findFirst.mockResolvedValue({ groupRunId: 'elsewhere' });
      await expect(service.create('host', SQUAD)).rejects.toBeInstanceOf(ConflictException);
    });

    it('cancels its own room when a concurrent request created an older one', async () => {
      asMember();
      prisma.groupRun.findFirst.mockResolvedValue(null);
      prisma.groupRunParticipant.findFirst.mockResolvedValue(null);
      prisma.groupRun.create.mockResolvedValue({ id: 'mine' });
      prisma.groupRun.findMany.mockResolvedValue([{ id: 'older' }, { id: 'mine' }]);
      await expect(service.create('host', SQUAD)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.groupRun.deleteMany).toHaveBeenCalledWith({ where: { id: 'mine' } });
    });
  });

  describe('join', () => {
    it('adds a new participant', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run({ participants: [run().participants[0]] }));
      prisma.groupRunParticipant.findFirst.mockResolvedValue(null);
      await service.join('u2', RUN);
      expect(prisma.groupRunParticipant.upsert).toHaveBeenCalledTimes(1);
    });

    it('is idempotent for someone already in the room', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run());
      await service.join('u2', RUN);
      expect(prisma.groupRunParticipant.upsert).not.toHaveBeenCalled();
    });

    it('refuses a finished room', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run({ status: GroupRunStatus.FINISHED }));
      await expect(service.join('u3', RUN)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses when the user is in a different open room', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run());
      prisma.groupRunParticipant.findFirst.mockResolvedValue({ groupRunId: 'elsewhere' });
      await expect(service.join('u3', RUN)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('start', () => {
    it('lets only the host start, WAITING -> ACTIVE', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run());
      await service.start('host', RUN);
      const call = prisma.groupRun.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: RUN, status: GroupRunStatus.WAITING });
      expect(call.data.status).toBe(GroupRunStatus.ACTIVE);
      expect(call.data.startedAt).toBeInstanceOf(Date);
    });

    it('rejects a non-host', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run());
      await expect(service.start('u2', RUN)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.groupRun.updateMany).not.toHaveBeenCalled();
    });

    it('rejects starting a room that is already running', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run({ status: GroupRunStatus.ACTIVE }));
      await expect(service.start('host', RUN)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('loses a race cleanly when another request started it first', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run());
      prisma.groupRun.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.start('host', RUN)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('leave', () => {
    it('promotes the earliest remaining participant when the host leaves', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValueOnce(run()).mockResolvedValueOnce(run({ hostId: 'u2' }));
      await service.leave('host', RUN);
      expect(prisma.groupRun.updateMany).toHaveBeenCalledWith({ where: { id: RUN }, data: { hostId: 'u2' } });
    });

    it('finishes the room when the last participant leaves', async () => {
      asMember();
      prisma.groupRun.findUnique
        .mockResolvedValueOnce(run({ participants: [run().participants[0]] }))
        .mockResolvedValueOnce(run({ status: GroupRunStatus.FINISHED, participants: [] }));
      await service.leave('host', RUN);
      const call = prisma.groupRun.updateMany.mock.calls[0][0];
      expect(call.data.status).toBe(GroupRunStatus.FINISHED);
      expect(call.data.endedAt).toBeInstanceOf(Date);
    });

    it('does nothing for someone who is not in the room', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run());
      await service.leave('u3', RUN);
      expect(prisma.groupRunParticipant.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('finish', () => {
    it('lets only the host finish', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run({ status: GroupRunStatus.ACTIVE }));
      await expect(service.finish('u2', RUN)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('marks an open room FINISHED with an end time', async () => {
      asMember();
      prisma.groupRun.findUnique.mockResolvedValue(run({ status: GroupRunStatus.ACTIVE }));
      await service.finish('host', RUN);
      const call = prisma.groupRun.updateMany.mock.calls[0][0];
      expect(call.data.status).toBe(GroupRunStatus.FINISHED);
      expect(call.where.status).toEqual({ in: [GroupRunStatus.WAITING, GroupRunStatus.ACTIVE] });
    });
  });
});
