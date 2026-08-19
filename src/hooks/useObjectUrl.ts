import { useEffect, useMemo } from 'react';

export function useObjectUrl(blob: Blob | null | undefined) {
  const url = useMemo(() => blob ? URL.createObjectURL(blob) : null, [blob]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}
