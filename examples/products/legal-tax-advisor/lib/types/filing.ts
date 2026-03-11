/** ITR-1 payload shape (simplified for MVP) */
export interface ITRPayload {
  personal?: {
    fullName?: string;
    pan?: string;
    dateOfBirth?: string;
    mobile?: string;
    address?: string;
  };
  income?: {
    salary?: number;
    otherIncome?: number;
    interest?: number;
  };
  deductions?: {
    section80C?: number;
    section80D?: number;
    hra?: number;
    other?: number;
  };
}
