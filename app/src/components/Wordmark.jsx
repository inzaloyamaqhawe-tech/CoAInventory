import React from 'react'

// A simple wings mark echoing the storefront's own logo silhouette — drawn,
// not a hotlinked image, so it renders crisp at any size and needs no asset.
export default function Wordmark({ size = 22 }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 48 24" fill="none" aria-hidden="true">
      <path
        d="M24 6c-3 4-9 6-16 5 4 2 8 2 12 1-4 3-9 4-14 3 5 3 11 3 16 0M24 6c3 4 9 6 16 5-4 2-8 2-12 1 4 3 9 4 14 3-5 3-11 3-16 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="7" r="1.6" fill="currentColor" />
    </svg>
  )
}
