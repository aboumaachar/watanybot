import type {
  EngagementAwardInput,
  EngagementAwardResult,
  EngagementSummary,
} from './types';
import { EngagementRepository } from './repository';

export class EngagementService {
  private readonly repository: EngagementRepository;

  constructor(repository = new EngagementRepository()) {
    this.repository = repository;
  }

  awardPoints(input: EngagementAwardInput): Promise<EngagementAwardResult> {
    return this.repository.awardPoints(input);
  }

  getSummary(userId: string): Promise<EngagementSummary> {
    return this.repository.getSummary(userId);
  }

  listLevels(): Promise<Record<string, unknown>[]> {
    return this.repository.listLevels();
  }

  listRules(): Promise<Record<string, unknown>[]> {
    return this.repository.listRules();
  }

  reversePointTransaction(input: {
    transactionId: string;
    actorUserId: string;
    reason: string;
  }): Promise<boolean> {
    return this.repository.reversePointTransaction(input);
  }
}

export const engagementService = new EngagementService();