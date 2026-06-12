/**
 * useAWSLivePrice
 * ---------------
 * React hook that fetches a live EC2 price from the backend,
 * falls back to the provided static price if the backend is unavailable.
 */
import { useEffect, useRef, useState } from 'react';
import { fetchEC2Price, PriceResult, PriceSource } from '../utils/awsPricingClient';

export interface LivePriceState {
  monthlyPrice: number;      // resolved price (live or fallback)
  pricePerHour: number;
  source: PriceSource | 'static';
  loading: boolean;
  error: boolean;
}

const _cache: Map<string, PriceResult> = new Map();

export function useAWSLivePrice(
  instanceType: string,
  region: string,
  os: string,
  staticFallbackPrice: number,   // used while loading or if backend is down
): LivePriceState {
  const [state, setState] = useState<LivePriceState>({
    monthlyPrice: staticFallbackPrice,
    pricePerHour: staticFallbackPrice / 730,
    source: 'static',
    loading: true,
    error: false,
  });

  const key = `${instanceType}|${region}|${os}`;
  const latestKey = useRef(key);
  latestKey.current = key;

  useEffect(() => {
    if (!instanceType) return;

    // Serve from cache immediately
    const cached = _cache.get(key);
    if (cached) {
      setState({
        monthlyPrice: cached.price_per_month,
        pricePerHour: cached.price_per_hour,
        source: cached.price_source,
        loading: false,
        error: false,
      });
      return;
    }

    setState(s => ({ ...s, loading: true, error: false, monthlyPrice: staticFallbackPrice }));

    fetchEC2Price(instanceType, region, os).then(result => {
      // Ignore stale responses
      if (latestKey.current !== key) return;

      if (result) {
        _cache.set(key, result);
        setState({
          monthlyPrice: result.price_per_month,
          pricePerHour: result.price_per_hour,
          source: result.price_source,
          loading: false,
          error: false,
        });
      } else {
        setState({
          monthlyPrice: staticFallbackPrice,
          pricePerHour: staticFallbackPrice / 730,
          source: 'static',
          loading: false,
          error: true,
        });
      }
    });
  }, [key, staticFallbackPrice]);

  return state;
}

/** Invalidate the price cache (e.g. when region changes) */
export function clearPriceCache(): void {
  _cache.clear();
}
