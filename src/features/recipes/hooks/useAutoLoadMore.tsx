import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Fires `loadMore` whenever the sentinel element comes near the viewport.
 * Pass `enabled: false` while a fetch is in flight, after an error, or when
 * there are no more pages — the observer is then simply not attached.
 */
export function useAutoLoadMore(sentinelRef: RefObject<HTMLDivElement | null>, loadMore: () => void, enabled: boolean) {
  // Latest-callback ref: the observer outlives renders, so it must not
  // read a stale `loadMore` closure.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!enabled || !el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreRef.current();
        }
      },
      // Begin loading ~600px before the sentinel is reached.
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinelRef, enabled]);
}
