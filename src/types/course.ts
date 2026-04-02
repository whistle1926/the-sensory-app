export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface ModuleContent {
  sections: {
    heading?: string;
    body: string;
  }[];
}
