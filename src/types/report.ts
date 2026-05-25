export interface ReportContent {
  clientInfo: {
    clientName: string;
    dateOfBirth: string;
    age: string;
    sessionDate: string;
    sessionNumber: number;
    referrer: string;
    diagnosis: string;
    parentCarer: string;
  };
  reasonForReferral: string;
  sessionOverview: string;
  observations: {
    sensoryResponses: string;
    engagementParticipation: string;
    communicationSocial: string;
    emotionalRegulation: string;
  };
  assessmentFindings: {
    sensoryProcessing: string;
    fineMotor: string;
    grossMotor: string;
    selfRegulation: string;
    playFunctional: string;
  };
  /**
   * Functional Review — daily-life areas the OT checks during an
   * assessment. Optional so reports written before this section
   * existed don't fail to parse.
   */
  functionalReview?: {
    feedingAndEating?: string;
    personalCareAndDressing?: string;
    toileting?: string;
    sleep?: string;
    school?: string;
    otherConcerns?: string;
    discussionWithParent?: string;
  };
  interventionsUsed: string;
  responseToIntervention: string;
  clinicalImpressions: string;
  recommendations: string;
  goals: {
    shortTerm: string;
    longTerm: string;
    nextSessionPlan: string;
  };
  homeProgrammeSuggestions: string;
  therapistName: string;
  therapistQualifications: string;
  reportDate: string;
  reviewDate: string;
}
