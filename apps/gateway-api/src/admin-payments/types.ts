export interface PaymentQuestion {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAnswer {
  id: string;
  questionId: string;
  value: string;
  isActive: boolean;
  activateAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface Announcement {
  id: string;
  text: string;
  enabled: boolean;
  createdAt: string;
}

export interface AdminPaymentsStore {
  questions: PaymentQuestion[];
  answers: PaymentAnswer[];
  announcements: Announcement[];
}

export interface AdminPaymentsDashboard {
  questions: PaymentQuestion[];
  activeAnswers: PaymentAnswer[];
  scheduledAnswers: PaymentAnswer[];
  answers: PaymentAnswer[];
  announcements: Announcement[];
  activeAnnouncements: Announcement[];
}

export interface PaymentFaqOverride {
  id: string;
  questionId: string;
  question: string;
  answer: string;
  tags: string[];
}

export interface ResolvedPaymentAnswer {
  question: PaymentQuestion;
  answer: PaymentAnswer;
  announcements: Announcement[];
  score: number;
}