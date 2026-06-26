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
  PROFILE:    '/(app)/profile',
} as const;

export type AppRoute = (typeof Routes)[keyof typeof Routes];