import type { Prisma, PrismaClient } from '@prisma/client';
import type { RequestRepository, RequestRow } from '../repositories/request-repository.js';
import type { MentorshipRepository } from '../repositories/mentorship-repository.js';
import type { UserRepository } from '../repositories/user-repository.js';
import type { ProfileRepository } from '../repositories/profile-repository.js';
import type { SystemConfigRepository } from '../repositories/system-config-repository.js';
import type { IdempotencyStore } from '../lib/idempotency.js';
import {
  buildIdempotencyKey,
  IDEMPOTENCY_TTL_SECONDS,
  withIdempotency,
} from '../lib/idempotency.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { toProfileSchema } from './profile-mapper.js';
import type { Profile } from '@mathitis/schemas';

const DEFAULT_MAX_FRESHMAN_REQUESTS = 3;
const REQUIRE_ADMIN_REQUEST_APPROVAL_KEY = 'REQUIRE_ADMIN_REQUEST_APPROVAL';

function academicYearFor(date = new Date()): string {
  const year = date.getFullYear();
  return `${year}/${year + 1}`;
}

export type RevealedRequest = RequestRow & { freshmanProfile?: Profile };

export interface RequestService {
  submit(
    freshmanId: string,
    input: { seniorHandle: string; message: string },
    idempotencyKey: string,
  ): Promise<RevealedRequest>;
  listIncoming(seniorId: string, status?: string): Promise<RevealedRequest[]>;
  listSent(freshmanId: string, status?: string): Promise<RevealedRequest[]>;
  getForInspection(
    requestId: string,
    viewerId: string,
    viewerRole: string,
  ): Promise<RevealedRequest>;
  accept(seniorId: string, requestId: string, idempotencyKey: string): Promise<RevealedRequest>;
  reject(seniorId: string, requestId: string, reason?: string): Promise<RevealedRequest>;
  cancel(freshmanId: string, requestId: string): Promise<RevealedRequest>;
  approveAdmin(adminId: string, requestId: string): Promise<RevealedRequest>;
  denyAdmin(adminId: string, requestId: string, reason?: string): Promise<RevealedRequest>;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

export function createRequestService(deps: {
  prisma: PrismaClient;
  requestRepository: RequestRepository;
  mentorshipRepository: MentorshipRepository;
  userRepository: UserRepository;
  profileRepository: ProfileRepository;
  systemConfigRepository: SystemConfigRepository;
  idempotencyStore: IdempotencyStore;
}): RequestService {
  const {
    prisma,
    requestRepository,
    mentorshipRepository,
    userRepository,
    profileRepository,
    systemConfigRepository,
    idempotencyStore,
  } = deps;

  async function requireRequest(id: string, tx?: Prisma.TransactionClient): Promise<RequestRow> {
    const request = await requestRepository.findById(id, tx);
    if (!request) {
      throw new NotFoundError('Mentorship request not found', 'REQUEST_NOT_FOUND');
    }
    return request;
  }

  /**
   * Attaches the applicant's rich profile to a request so the target senior can
   * inspect the full freshman portfolio (bio, rich cards, semester) within
   * their inbox. This is the request-based privacy reveal.
   */
  async function attachFreshmanProfile(row: RequestRow): Promise<RevealedRequest> {
    const profile = await profileRepository.findByUserId(row.freshmanId);
    return { ...row, freshmanProfile: profile ? toProfileSchema(profile) : undefined };
  }

  async function submit(
    freshmanId: string,
    input: { seniorHandle: string; message: string },
    idempotencyKey: string,
  ) {
    return withIdempotency(
      idempotencyStore,
      buildIdempotencyKey('request-submit', idempotencyKey),
      IDEMPOTENCY_TTL_SECONDS,
      async () => {
        const senior = await userRepository.findByHandle(input.seniorHandle);
        if (!senior || senior.deletedAt !== null || senior.role !== 'senior') {
          throw new NotFoundError('Senior not found', 'SENIOR_NOT_FOUND');
        }
        if (senior.id === freshmanId) {
          throw new ValidationError('You cannot request mentorship from yourself');
        }

        const seniorProfile = await profileRepository.findByUserId(senior.id);
        if (!seniorProfile?.isAcceptingRequests) {
          throw new ValidationError('This senior is not accepting requests');
        }

        const maxRequests = await systemConfigRepository.getNumber(
          'MAX_FRESHMAN_REQUESTS',
          DEFAULT_MAX_FRESHMAN_REQUESTS,
        );
        const activeCount = await requestRepository.countActiveByFreshman(freshmanId);
        if (activeCount >= maxRequests) {
          throw new ConflictError(
            `Request limit reached: you can have at most ${maxRequests} active applications`,
            'REQUEST_LIMIT_REACHED',
          );
        }

        try {
          const created = await requestRepository.create({
            freshmanId,
            seniorId: senior.id,
            message: input.message,
          });
          return await attachFreshmanProfile(created);
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ConflictError(
              'You already have an active request with this senior',
              'DUPLICATE_REQUEST',
            );
          }
          throw error;
        }
      },
    );
  }

  async function listIncoming(seniorId: string, status?: string) {
    const rows = await requestRepository.listIncoming(
      seniorId,
      status as Parameters<RequestRepository['listIncoming']>[1],
    );
    return Promise.all(rows.map(attachFreshmanProfile));
  }

  async function listSent(freshmanId: string, status?: string) {
    return requestRepository.listSent(
      freshmanId,
      status as Parameters<RequestRepository['listSent']>[1],
    );
  }

  /**
   * The target senior inspecting a request gains full visibility of the
   * applicant's rich profile. Freshmen may only inspect their own sent
   * requests; admins/developers may inspect any request.
   */
  async function getForInspection(requestId: string, viewerId: string, viewerRole: string) {
    const request = await requireRequest(requestId);
    const isSeniorTarget = request.seniorId === viewerId && viewerRole === 'senior';
    const isFreshmanOwner = request.freshmanId === viewerId;
    const isAdmin = viewerRole === 'administrator' || viewerRole === 'developer';
    if (!isSeniorTarget && !isFreshmanOwner && !isAdmin) {
      throw new ForbiddenError('You do not have access to this request');
    }
    return attachFreshmanProfile(request);
  }

  async function accept(seniorId: string, requestId: string, idempotencyKey: string) {
    return withIdempotency(
      idempotencyStore,
      buildIdempotencyKey(`request-accept-${seniorId}`, idempotencyKey),
      IDEMPOTENCY_TTL_SECONDS,
      async () => {
        const request = await requireRequest(requestId);
        if (request.seniorId !== seniorId) {
          throw new ForbiddenError('You cannot accept a request not addressed to you');
        }
        if (request.status !== 'pending' && request.status !== 'pending_admin_approval') {
          throw new ConflictError('This request can no longer be accepted', 'REQUEST_NOT_ACTIVE');
        }

        const freshman = await userRepository.findActiveById(request.freshmanId);
        if (!freshman) {
          throw new ValidationError('The applicant account is no longer active');
        }

        return prisma.$transaction(async (tx) => {
          const seniorProfile = await requestRepository.lockSeniorProfile(request.seniorId, tx);
          if (!seniorProfile) {
            throw new NotFoundError('Senior profile not found', 'SENIOR_PROFILE_NOT_FOUND');
          }
          if (!seniorProfile.isAcceptingRequests) {
            throw new ValidationError('This senior is not accepting requests');
          }

          const activeCount = await mentorshipRepository.countActiveBySenior(request.seniorId, tx);
          if (activeCount >= seniorProfile.maxMentees) {
            throw new ConflictError('Senior has reached maximum mentee capacity', 'CAPACITY_EXCEEDED');
          }

          const requireAdminApproval = await systemConfigRepository.getBoolean(
            REQUIRE_ADMIN_REQUEST_APPROVAL_KEY,
            false,
          );

          if (requireAdminApproval) {
            await requestRepository.updateStatus(requestId, 'pending_admin_approval', undefined, tx);
          } else {
            await requestRepository.updateStatus(requestId, 'accepted', undefined, tx);
            await mentorshipRepository.create(
              {
                requestId,
                freshmanId: request.freshmanId,
                seniorId: request.seniorId,
                semester: freshman.semester,
                academicYear: academicYearFor(),
              },
              tx,
            );

            if (activeCount + 1 >= seniorProfile.maxMentees) {
              await requestRepository.cancelPendingBeyondCapacity(request.seniorId, tx);
            }
          }

          const updated = await requireRequest(requestId, tx);
          return attachFreshmanProfile(updated);
        });
      },
    );
  }

  async function reject(seniorId: string, requestId: string, reason?: string) {
    const request = await requireRequest(requestId);
    if (request.seniorId !== seniorId) {
      throw new ForbiddenError('You cannot reject a request not addressed to you');
    }
    if (request.status !== 'pending' && request.status !== 'pending_admin_approval') {
      throw new ConflictError('This request can no longer be rejected', 'REQUEST_NOT_ACTIVE');
    }
    await requestRepository.updateStatus(requestId, 'rejected', {
      rejectionReason: reason ?? null,
    });
    return requireRequest(requestId);
  }

  async function cancel(freshmanId: string, requestId: string) {
    const request = await requireRequest(requestId);
    if (request.freshmanId !== freshmanId) {
      throw new ForbiddenError('You can only cancel your own requests');
    }
    if (request.status !== 'pending' && request.status !== 'pending_admin_approval') {
      throw new ConflictError('This request can no longer be cancelled', 'REQUEST_NOT_ACTIVE');
    }
    await requestRepository.updateStatus(requestId, 'cancelled', { rejectionReason: null });
    return requireRequest(requestId);
  }

  async function approveAdmin(adminId: string, requestId: string) {
    const request = await requireRequest(requestId);
    if (request.status !== 'pending_admin_approval') {
      throw new ConflictError('Only requests awaiting admin approval can be approved', 'REQUEST_NOT_ACTIVE');
    }

    const freshman = await userRepository.findActiveById(request.freshmanId);
    if (!freshman) {
      throw new ValidationError('The applicant account is no longer active');
    }

    return prisma.$transaction(async (tx) => {
      const seniorProfile = await requestRepository.lockSeniorProfile(request.seniorId, tx);
      if (!seniorProfile) {
        throw new NotFoundError('Senior profile not found', 'SENIOR_PROFILE_NOT_FOUND');
      }
      const activeCount = await mentorshipRepository.countActiveBySenior(request.seniorId, tx);
      if (activeCount >= seniorProfile.maxMentees) {
        throw new ConflictError('Senior has reached maximum mentee capacity', 'CAPACITY_EXCEEDED');
      }

      await requestRepository.updateStatus(
        requestId,
        'accepted',
        { reviewedByAdminId: adminId },
        tx,
      );
      await mentorshipRepository.create(
        {
          requestId,
          freshmanId: request.freshmanId,
          seniorId: request.seniorId,
          semester: freshman.semester,
          academicYear: academicYearFor(),
        },
        tx,
      );

      if (activeCount + 1 >= seniorProfile.maxMentees) {
        await requestRepository.cancelPendingBeyondCapacity(request.seniorId, tx);
      }

      const updated = await requireRequest(requestId, tx);
      return attachFreshmanProfile(updated);
    });
  }

  async function denyAdmin(adminId: string, requestId: string, reason?: string) {
    const request = await requireRequest(requestId);
    if (request.status !== 'pending_admin_approval') {
      throw new ConflictError('Only requests awaiting admin approval can be denied', 'REQUEST_NOT_ACTIVE');
    }
    await requestRepository.updateStatus(requestId, 'rejected', {
      rejectionReason: reason ?? 'Denied by administrator',
      reviewedByAdminId: adminId,
    });
    return requireRequest(requestId);
  }

  return {
    submit,
    listIncoming,
    listSent,
    getForInspection,
    accept,
    reject,
    cancel,
    approveAdmin,
    denyAdmin,
  };
}