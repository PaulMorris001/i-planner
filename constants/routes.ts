export const Routes = {
  WELCOME:          '/(onboarding)/welcome',
  LOGIN:            '/(onboarding)/login',
  REGISTER:         '/(onboarding)/register',
  FORGOT_PASSWORD:  '/(onboarding)/forgot-password',
  FOCUS:            '/(onboarding)/focus',
  STUDENT_PLAN:     '/(onboarding)/student-plan',
  EXAM_PLAN:        '/(onboarding)/exam-plan',
  PROFESSIONAL_PLAN: '/(onboarding)/professional-plan',

  DASHBOARD:  '/(app)/dashboard',
  PLANNER:    '/(app)/planner',
  TASKS:      '/(app)/tasks',
  COACH:      '/(app)/coach',
  PROFILE:    '/(app)/profile',
  GOALS:      '/goals',
  HABITS:     '/habits',
  PLANS:      '/plans',
  CERT_TRACKER: '/cert-tracker',
  CLASSES:    '/classes',
  SYLLABI:    '/syllabi',
  EXAMS:      '/exams',
} as const;

export type AppRoute = (typeof Routes)[keyof typeof Routes];