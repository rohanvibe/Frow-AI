/**
 * Frow Analytics Utility
 * 
 * Connected to Vercel Analytics.
 */
import { track } from '@vercel/analytics'

type AnalyticsEvent = 
  | 'demo_opened'
  | 'demo_interaction'
  | 'signup_started'
  | 'signup_completed'
  | 'google_login_completed'
  | 'chat_started'
  | 'first_message_sent'
  | 'chat_sent'
  | 'sidebar_click'
  | 'sidebar_jump'
  | 'share_created'
  | 'snapshot_exported'
  | 'tutorial_started'
  | 'tutorial_completed'
  | 'feedback_submitted'
  | 'byok_opened'
  | 'return_visit'
  | 'return_user'

export const trackEvent = (event: AnalyticsEvent, metadata: Record<string, any> = {}) => {
  // 1. Log to console in dev for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Analytics] ${event}`, metadata)
  }

  // 2. Fire to Vercel Analytics
  try {
    track(event, metadata)
  } catch (e) {
    console.error('Analytics tracking failed', e)
  }
}

