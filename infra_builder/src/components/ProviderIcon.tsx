import React from 'react';

export type ProviderName = 'aws' | 'azure' | 'gcp' | 'onprem';

interface Props {
  provider: ProviderName;
  size?: number;
  className?: string;
}

function AWSLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="#FF9900" />
      <path d="M16.5 29.5c2.5 1.5 6.5 2 9.5 1s5-2.5 5-4-.5-2.5-3-3.5-5-1.5-6-2.5-1-2 0-3 2.5-1.5 5-1 4 .5 5.5 1.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M33 30v3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M28 34c0 1.5-2 3-5 3s-5-1.5-5-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 26v-8l4-2 4 2v8l-4 2-4-2z" stroke="#fff" strokeWidth="1.2" fill="rgba(255,255,255,0.15)" />
      <path d="M19 18v8" stroke="#fff" strokeWidth="1.2" />
      <path d="M15 22h8" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}

function AzureLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="#0078D4" />
      <path d="M14 34l8-22h4l-6 16h12l-2 6H14z" fill="#fff" opacity="0.9" />
      <path d="M26 12l-6 16h10l-4 10" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.3" />
      <rect x="16" y="14" width="12" height="2" rx="1" fill="#fff" opacity="0.5" />
      <rect x="14" y="30" width="16" height="2" rx="1" fill="#fff" opacity="0.5" />
      <rect x="12" y="36" width="20" height="2" rx="1" fill="#fff" opacity="0.3" />
    </svg>
  );
}

function GCPLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="#4285F4" />
      <path d="M20 36l-5-9 5-9h10l5 9-5 9H20z" fill="#fff" opacity="0.2" />
      <path d="M22 32l-3-6 3-6h7l3 6-3 6h-7z" fill="#34A853" />
      <path d="M24 20l-3 6 3 6 3-6-3-6z" fill="#fff" opacity="0.3" />
      <circle cx="24" cy="26" r="2" fill="#EA4335" />
      <path d="M29 20h3l2 4-2 4h-3" fill="#FBBC05" opacity="0.8" />
      <path d="M16 28l2 4h3" stroke="#fff" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

function OnPremLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="#8b5cf6" />
      <rect x="12" y="10" width="24" height="8" rx="1.5" stroke="#fff" strokeWidth="1.5" fill="rgba(255,255,255,0.1)" />
      <rect x="14" y="12" width="8" height="4" rx="0.5" fill="#fff" opacity="0.5" />
      <rect x="24" y="12" width="8" height="4" rx="0.5" fill="#fff" opacity="0.5" />
      <rect x="12" y="21" width="24" height="8" rx="1.5" stroke="#fff" strokeWidth="1.5" fill="rgba(255,255,255,0.1)" />
      <rect x="14" y="23" width="8" height="4" rx="0.5" fill="#fff" opacity="0.5" />
      <rect x="24" y="23" width="8" height="4" rx="0.5" fill="#fff" opacity="0.5" />
      <rect x="12" y="32" width="24" height="8" rx="1.5" stroke="#fff" strokeWidth="1.5" fill="rgba(255,255,255,0.1)" />
      <rect x="16" y="34" width="16" height="4" rx="0.5" fill="#fff" opacity="0.5" />
    </svg>
  );
}

export default function ProviderIcon({ provider, size = 20 }: Props) {
  switch (provider) {
    case 'aws':
      return <AWSLogo size={size} />;
    case 'azure':
      return <AzureLogo size={size} />;
    case 'gcp':
      return <GCPLogo size={size} />;
    case 'onprem':
      return <OnPremLogo size={size} />;
    default:
      return null;
  }
}

export function getProviderIcon(provider: string, size = 20): React.ReactNode {
  switch (provider) {
    case 'aws':
      return <AWSLogo size={size} />;
    case 'azure':
      return <AzureLogo size={size} />;
    case 'gcp':
      return <GCPLogo size={size} />;
    case 'onprem':
      return <OnPremLogo size={size} />;
    default:
      return null;
  }
}
