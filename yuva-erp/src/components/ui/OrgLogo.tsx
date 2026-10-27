import React from 'react';
import { useInstitute } from '../../Context/InstituteContext';

// The logo of the coaching, or its first letter when no logo was uploaded
export const OrgLogo: React.FC<{ className: string; fallbackClass: string }> = ({ className, fallbackClass }) => {
  const { profile } = useInstitute();
  if (profile.logo) {
    return <img src={profile.logo} alt={profile.name} className={`${className} object-contain bg-white`} />;
  }
  return <div className={`${className} ${fallbackClass} flex items-center justify-center`}>{profile.name.slice(0, 1)}</div>;
};
