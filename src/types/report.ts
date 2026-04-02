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
