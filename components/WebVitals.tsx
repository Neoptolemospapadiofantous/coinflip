'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { devLog } from '@/lib/utils';

/**
 * Web Vitals monitoring component
 *
 * Tracks Core Web Vitals:
 * - LCP (Largest Contentful Paint) - loading performance
 * - FID (First Input Delay) - interactivity
 * - CLS (Cumulative Layout Shift) - visual stability
 * - FCP (First Contentful Paint) - initial render
 * - TTFB (Time to First Byte) - server response
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    // Log in development for debugging
    devLog.log(`[WebVitals] ${metric.name}:`, {
      value: metric.value.toFixed(2),
      rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
      id: metric.id,
    });

    // In production, you would send to analytics service:
    // if (process.env.NODE_ENV === 'production') {
    //   sendToAnalytics({
    //     name: metric.name,
    //     value: metric.value,
    //     rating: metric.rating,
    //     id: metric.id,
    //   });
    // }
  });

  return null;
}
